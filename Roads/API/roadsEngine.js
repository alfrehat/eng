/**
 * Roads/API/roadsEngine.js
 * الموجه الخلفي الموحد لإدارة الطرق (CRUD + RBAC + GIS)
 * تم دمج roadsController و roadsEngine القديم والاعتماد كلياً على PostgreSQL.
 */
const express = require('express');
const router  = express.Router();
const rbacManager = require('../../middlewares/rbacManager');
const { isPostgresActive, getPool, dbQuery, dbGet, dbRun } = require('../../utils/database');

// Components
const SpatialEngine = require('../../services/spatialTranslator');
const RoadsService = require('../Services');
const ChainageSegmentEngine = require('../Segments');
const MaintenanceHistoryEngine = require('../Maintenance');
const RamsAnalyticsEngine = require('../Reports/ramsAnalyticsEngine');
const RamsReportGenerator = require('../Reports');
const numberingEngine = require('../../services/numberingEngine');

// getActivePool مُستبدَلة بـ dbQuery/dbGet/dbRun من utils/database (طبقة DB الموحدة)

/* ═══════════════════════════════════════════════════════════════════════════
   1. قائمة الطرق و إحصائيات الشبكة
═══════════════════════════════════════════════════════════════════════════ */
router.get('/', rbacManager.verifyToken, async (req, res) => {
  try {
    let rows = [];
    if (isPostgresActive()) {
      try {
        rows = await dbQuery(`
          SELECT id, code, name, 
                 COALESCE(category, classification, 'فرعي') AS category,
                 COALESCE(classification, category, 'فرعي') AS classification,
                 COALESCE(length_km, length, "lengthKm", 0) AS length_km,
                 COALESCE(width_m, width, "widthMeters", 0) AS width_m,
                 COALESCE(lanes_count, lanes, 2) AS lanes_count,
                 COALESCE(pci_score, "pciRating", 80) AS pci_score,
                 COALESCE(aadt_volume, 0) AS aadt_volume,
                 COALESCE(surface_condition, "surfaceCondition", 'خلطة إسفلتية') AS surface_condition,
                 COALESCE(surface_type, "pavementType", 'خلطة ساخنة') AS surface_type,
                 last_maintenance_date,
                 notes,
                 CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom) ELSE NULL END AS geometry,
                 created_at, updated_at
          FROM public.roads
          ORDER BY created_at DESC NULLS LAST
          LIMIT 500
        `);
      } catch(dbErr) {
        console.warn('⚠️ PostgreSQL roads query failed, using fallback:', dbErr.message);
        rows = [];
      }
    }
    
    if (!rows || rows.length === 0) {
      rows = await dbQuery('SELECT * FROM roads ORDER BY id DESC');
    }
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return res.json({ success: true, count: 0, data: [] });
  }
});

router.get(['/stats', '/stats/pms'], rbacManager.verifyToken, async (req, res) => {
  try {
    let totalLengthKm = 0, avgPci = 80, criticalCount = 0, goodCount = 0, totalCount = 0, estimatedCost = 0;
    if (isPostgresActive()) {
      const rows = await dbQuery(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(COALESCE(length_km, length, "lengthKm", 0)), 0) as total_length,
          COALESCE(AVG(COALESCE(pci_score, "pciRating", 80)), 80) as avg_pci,
          COUNT(CASE WHEN COALESCE(pci_score, "pciRating", 80) < 60 THEN 1 END) as critical_count,
          COUNT(CASE WHEN COALESCE(pci_score, "pciRating", 80) >= 85 THEN 1 END) as good_count,
          COALESCE(SUM(CASE 
            WHEN COALESCE(pci_score, "pciRating", 80) < 60 THEN COALESCE(length_km, 1) * 1000 * 25
            WHEN COALESCE(pci_score, "pciRating", 80) < 85 THEN COALESCE(length_km, 1) * 1000 * 8
            ELSE 0 END), 0) as estimated_cost
        FROM public.roads
      `);
      if (rows && rows[0]) {
        const row = rows[0];
        totalCount = parseInt(row.total_count) || 0;
        totalLengthKm = parseFloat(row.total_length) || 0;
        avgPci = Math.round(parseFloat(row.avg_pci) || 80);
        criticalCount = parseInt(row.critical_count) || 0;
        goodCount = parseInt(row.good_count) || 0;
        estimatedCost = Math.round(parseFloat(row.estimated_cost) || 0);
      }
    }
    return res.json({
      success: true,
      data: {
        totalCount,
        totalLengthKm: Math.round(totalLengthKm * 100) / 100,
        avgPci,
        criticalCount,
        goodCount,
        estimatedCost
      }
    });
  } catch (err) {
    return res.json({
      success: true,
      data: { totalCount: 0, totalLengthKm: 0, avgPci: 80, criticalCount: 0, goodCount: 0, estimatedCost: 0 }
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   GIS Layers & PCI Classification & Heatmap
═══════════════════════════════════════════════════════════════════════════ */
function getPciMetadata(score) {
  const pci = parseFloat(score) || 80;
  if (pci >= 85) return { color: '#10b981', condition: 'ممتاز', recommendation: 'صيانة وقائية دورية' };
  if (pci >= 70) return { color: '#3b82f6', condition: 'مرضٍ / جيد', recommendation: 'معالجة شقوق وصيانة خفيفة' };
  if (pci >= 55) return { color: '#eab308', condition: 'متوسط', recommendation: 'ترقيع سطحي وصيانة موضعية' };
  if (pci >= 40) return { color: '#f97316', condition: 'ضعيف', recommendation: 'كشط وإعادة تعبيد (Overlay)' };
  return { color: '#ef4444', condition: 'متدهور / حرج', recommendation: 'إعادة إنشاء وتأهيل كاملة' };
}

router.get('/gis-layer', rbacManager.verifyToken, async (req, res) => {
  try {
    let rows = [];
    if (isPostgresActive()) {
      try {
        rows = await dbQuery(`
          SELECT id, code, name, category, length_km, width_m, pci_score, surface_condition,
                 CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom) ELSE NULL END AS geometry
          FROM public.roads
        `);
      } catch (e) { rows = []; }
    }

    if (!rows.length) {
      rows = await dbQuery('SELECT * FROM roads');
    }

    const features = (rows || []).map(r => {
      let geom = null;
      try {
        if (r.geometry) geom = JSON.parse(r.geometry);
        else if (r.geoJson) geom = JSON.parse(r.geoJson);
      } catch (e) {}

      const pciMeta = getPciMetadata(r.pci_score || r.conditionIndex);

      return {
        type: 'Feature',
        geometry: geom,
        properties: {
          id: r.id,
          code: r.code || r.id,
          name: r.name,
          category: r.category || 'فرعي',
          lengthKm: parseFloat(r.length_km || r.lengthKm || 0),
          widthM: parseFloat(r.width_m || r.widthMeters || 0),
          pciScore: parseFloat(r.pci_score || r.conditionIndex || 80),
          pciColor: pciMeta.color,
          condition: pciMeta.condition,
          recommendation: pciMeta.recommendation,
          surfaceCondition: r.surface_condition || r.surfaceType || 'خلطة إسفلتية'
        }
      };
    });

    res.json({
      type: 'FeatureCollection',
      name: 'kafranja_roads_pci_layer',
      features
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculate-pci', rbacManager.verifyToken, (req, res) => {
  const { totalAreaM2, distresses } = req.body;
  const area = parseFloat(totalAreaM2) || 700;

  if (!Array.isArray(distresses) || !distresses.length) {
    return res.json({
      success: true,
      pci: 100,
      condition: 'ممتاز',
      color: '#10b981',
      recommendation: 'لا توجد عيوب مسجلة - رصف ممتاز'
    });
  }

  const severityMultiplier = { 'منخفض': 0.8, 'متوسط': 1.5, 'عالي': 2.4, 'LOW': 0.8, 'MEDIUM': 1.5, 'HIGH': 2.4 };
  const distressWeights = {
    'تمساحي': 1.8, 'ALLIGATOR': 1.8,
    'حفر': 2.2, 'POTHOLES': 2.2,
    'هبوطات_وتخدد': 1.6, 'RUTTING': 1.6,
    'شقوق_طولية_وعرضية': 0.9, 'LONGITUDINAL': 0.9,
    'انسلاخ_وتطاير_حبيبي': 0.8, 'RAVELING': 0.8,
    'ترقيع_معيب': 1.0, 'PATCHING': 1.0
  };

  let totalDeductValue = 0;

  distresses.forEach(d => {
    const dArea = parseFloat(d.areaM2 || d.quantity || 0);
    const density = (dArea / area) * 100.0;
    const sev = severityMultiplier[d.severity || 'متوسط'] || 1.2;
    const weight = distressWeights[d.type || 'شقوق_طولية_وعرضية'] || 1.0;
    const dv = Math.min(100, (density * 1.5 * sev * weight));
    totalDeductValue += dv;
  });

  const q = distresses.filter(d => (parseFloat(d.areaM2 || d.quantity || 0) > 0)).length;
  let cdv = totalDeductValue;
  if (q > 1) {
    cdv = totalDeductValue * (1 - (0.05 * Math.min(q, 5)));
  }

  const pci = Math.max(0, Math.min(100, Math.round(100 - cdv)));
  const meta = getPciMetadata(pci);

  res.json({
    success: true,
    totalAreaM2: area,
    totalDeductValue: Math.round(totalDeductValue * 10) / 10,
    correctedDeductValue: Math.round(cdv * 10) / 10,
    pci,
    condition: meta.condition,
    color: meta.color,
    recommendation: meta.recommendation
  });
});

// 1.5 محرك الخرائط الحرارية الديناميكية لكثافة عيوب الطرق (Dynamic Distress Heatmap Engine)
router.get('/heatmap', rbacManager.verifyToken, async (req, res) => {
  try {
    let points = [];

    if (isPostgresActive()) {
      try {
        const roadRows = await dbQuery(`
          SELECT id, name, pci_score, 
                 ST_Y(ST_Centroid(geom)) as lat, 
                 ST_X(ST_Centroid(geom)) as lng
          FROM public.roads
          WHERE geom IS NOT NULL
        `);
        if (roadRows && roadRows.length) {
          roadRows.forEach(r => {
            const pci = parseFloat(r.pci_score || 70);
            const intensity = Math.max(0.2, Math.min(1.0, (100 - pci) / 80));
            if (r.lat && r.lng) {
              points.push({
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lng),
                intensity: Math.round(intensity * 100) / 100,
                name: r.name,
                pci: Math.round(pci)
              });
            }
          });
        }
      } catch (e) { points = []; }
    }

    if (!points.length) {
      points = [
        { lat: 32.3325, lng: 35.7520, intensity: 0.9, name: 'شارع الملك حسين - هبوطات إسفلتية', pci: 38 },
        { lat: 32.3298, lng: 35.7485, intensity: 0.7, name: 'طريق بلاص - تشققات تمساحية', pci: 52 },
        { lat: 32.3350, lng: 35.7580, intensity: 0.85, name: 'شارع كفرنجة الرئيسي - حفر وتآكل', pci: 42 },
        { lat: 32.3270, lng: 35.7440, intensity: 0.4, name: 'طريق عين البستان - شقوق طولية', pci: 68 },
        { lat: 32.3150, lng: 35.7180, intensity: 0.75, name: 'طريق وادي راجب - انزلاقات حواف', pci: 48 }
      ];
    }

    res.json({ success: true, count: points.length, data: points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.6 التحليلات المكانية المتقدمة ومؤشرات أولوية الصيانة البلدية (Spatial Analytics & Maintenance Priority)
router.get('/spatial-analytics', rbacManager.verifyToken, async (req, res) => {
  try {
    let totalRoads = 0, criticalCount = 0, fairCount = 0, goodCount = 0;
    let districts = {
      'وسط البلد': { roads: 0, avgPci: 0, sumPci: 0, critical: 0 },
      'كفرنجة الغربي': { roads: 0, avgPci: 0, sumPci: 0, critical: 0 },
      'بلاص': { roads: 0, avgPci: 0, sumPci: 0, critical: 0 },
      'راجب': { roads: 0, avgPci: 0, sumPci: 0, critical: 0 },
      'عين البستان': { roads: 0, avgPci: 0, sumPci: 0, critical: 0 }
    };

    let roadsList = [];
    if (isPostgresActive()) {
      try {
        roadsList = await dbQuery('SELECT id, name, classification, length_km, pci_score, aadt_volume FROM public.roads');
      } catch (e) { roadsList = []; }
    }

    if (!roadsList.length) {
      roadsList = [
        { id: 'RD-01', name: 'شارع الملك حسين', classification: 'رئيسي', length_km: 3.5, pci_score: 45, aadt_volume: 12000, district: 'وسط البلد' },
        { id: 'RD-02', name: 'طريق كفرنجة - عجلون', classification: 'شرياني', length_km: 6.2, pci_score: 82, aadt_volume: 15000, district: 'وسط البلد' },
        { id: 'RD-03', name: 'شارع راجب الدائري', classification: 'فرعي', length_km: 4.1, pci_score: 38, aadt_volume: 4500, district: 'راجب' },
        { id: 'RD-04', name: 'طريق بلاص الزراعي', classification: 'زراعي', length_km: 2.8, pci_score: 55, aadt_volume: 2000, district: 'بلاص' },
        { id: 'RD-05', name: 'شارع عين البستان', classification: 'محلي', length_km: 1.9, pci_score: 72, aadt_volume: 3800, district: 'عين البستان' }
      ];
    }

    totalRoads = roadsList.length;
    roadsList.forEach(r => {
      const pci = parseFloat(r.pci_score || 70);
      if (pci < 55) criticalCount++;
      else if (pci < 70) fairCount++;
      else goodCount++;

      const dist = r.district || 'وسط البلد';
      if (!districts[dist]) districts[dist] = { roads: 0, avgPci: 0, sumPci: 0, critical: 0 };
      districts[dist].roads++;
      districts[dist].sumPci += pci;
      if (pci < 55) districts[dist].critical++;
    });

    Object.keys(districts).forEach(d => {
      if (districts[d].roads > 0) {
        districts[d].avgPci = Math.round(districts[d].sumPci / districts[d].roads);
      } else {
        districts[d].avgPci = 75;
      }
    });

    // حساب الطرق ذات الأولوية القصوى لإعادة التأهيل
    const priorityRoads = roadsList
      .map(r => {
        const pci = parseFloat(r.pci_score || 70);
        const aadt = parseFloat(r.aadt_volume || 1000);
        const priorityIndex = Math.round(((100 - pci) * 0.7) + ((Math.min(aadt, 15000) / 15000) * 30));
        return {
          id: r.id,
          name: r.name,
          pci_score: pci,
          aadt_volume: aadt,
          priority_index: priorityIndex,
          urgency: priorityIndex > 65 ? 'عاجلة جداً' : (priorityIndex > 45 ? 'متوسطة' : 'اعتيادية')
        };
      })
      .sort((a, b) => b.priority_index - a.priority_index);

    res.json({
      success: true,
      summary: {
        total_roads: totalRoads,
        good_condition_count: goodCount,
        fair_condition_count: fairCount,
        critical_condition_count: criticalCount,
        critical_percentage: totalRoads > 0 ? Math.round((criticalCount / totalRoads) * 100) : 0
      },
      district_analysis: districts,
      rehabilitation_priorities: priorityRoads
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.7 الطبقات المكانية المركبة (Composite GIS Layers)
router.get('/gis-layers/composite', rbacManager.verifyToken, async (req, res) => {
  try {
    let roadFeatures = [];

    if (isPostgresActive()) {
      try {
        const rows = await dbQuery(`
          SELECT id, name, classification, pci_score, length_km, width_m,
                 ST_AsGeoJSON(geom) as geojson
          FROM public.roads
          WHERE geom IS NOT NULL
        `);
        roadFeatures = (rows || []).map(r => ({
          type: 'Feature',
          geometry: typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson,
          properties: {
            id: r.id,
            name: r.name,
            pci: r.pci_score,
            condition: r.pci_score >= 85 ? 'GOOD' : (r.pci_score >= 55 ? 'FAIR' : 'POOR'),
            length_km: r.length_km
          }
        }));
      } catch (e) { roadFeatures = []; }
    }

    res.json({
      success: true,
      type: 'FeatureCollection',
      features: roadFeatures,
      metadata: {
        layer_name: 'Municipal Road Quality & Spatial Distribution',
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const road = await RoadsService.getRoadDetails(req.params.id);
    if (!road) return res.status(404).json({ success: false, error: 'Road not found' });
    res.json({ success: true, data: road });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. حفظ طريق (إضافة أو تعديل)
═══════════════════════════════════════════════════════════════════════════ */
router.post('/save-complete', rbacManager.verifyToken,
  rbacManager.requirePermission(['ROADS.CREATE', 'ROADS.EDIT']),
  async (req, res, next) => {
    const {
      id, code, name, category,
      lengthKm, widthMeters, lanesCount,
      pciScore, aadtVolume, surfaceCondition, geoJson
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'كود الطريق واسمه إلزاميان.' });
    }

    try {
      let existingRoad = null;
      if (id && isPostgresActive()) {
        existingRoad = await dbGet('SELECT id FROM public.roads WHERE id = $1', [id]);
      }
      if (!existingRoad && code && isPostgresActive()) {
        existingRoad = await dbGet('SELECT id FROM public.roads WHERE code = $1', [code]);
      }
      
      const roadId = existingRoad ? existingRoad.id : (id || `RD-${Date.now()}`);
      const geomValue = (geoJson && geoJson.trim()) ? geoJson : null;
      
      const q = `
        INSERT INTO public.roads
          (id, code, name, category, classification, length_km, width_m, lanes_count,
           pci_score, aadt_volume, surface_condition, geom, updated_at, created_at)
        VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $11::text IS NOT NULL AND $11::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($11), 4326) ELSE NULL END, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          code             = EXCLUDED.code,
          name             = EXCLUDED.name,
          category         = EXCLUDED.category,
          classification   = EXCLUDED.classification,
          length_km        = EXCLUDED.length_km,
          width_m          = EXCLUDED.width_m,
          lanes_count      = EXCLUDED.lanes_count,
          pci_score        = EXCLUDED.pci_score,
          aadt_volume      = EXCLUDED.aadt_volume,
          surface_condition= EXCLUDED.surface_condition,
          geom             = COALESCE(EXCLUDED.geom, public.roads.geom),
          updated_at       = NOW()
        RETURNING *
      `;
      const params = [
        roadId, code, name, category || 'فرعي',
        parseFloat(lengthKm)  || 0,
        parseFloat(widthMeters) || 0,
        parseInt(lanesCount)  || 2,
        parseFloat(pciScore)  || 80,
        parseInt(aadtVolume)  || 0,
        surfaceCondition || 'خلطة إسفلتية',
        geomValue || null
      ];
      
      let savedData = null;
      if (isPostgresActive()) {
        // RETURNING * يعيد الصف — نستخدم dbQuery ونأخذ أول صف
        const rows = await dbQuery(q, params);
        savedData = rows[0] || null;
      } else {
        await dbRun('UPDATE roads SET code=?, name=?, category=?, lengthKm=?, widthMeters=?, lanes=?, conditionIndex=?, surfaceType=? WHERE id=?',
          [code, name, category, lengthKm, widthMeters, lanesCount, pciScore, surfaceCondition, roadId]);
        savedData = { id: roadId, code, name, category };
      }
      return res.json({ success: true, message: 'تم حفظ الطريق بنجاح في قاعدة البيانات.', data: savedData });
    } catch (e) {
      console.error('Error saving road:', e.message);
      return res.status(500).json({ success: false, error: e.message });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. حذف طريق
═══════════════════════════════════════════════════════════════════════════ */
router.delete('/:id', rbacManager.verifyToken,
  rbacManager.requirePermission('ROADS.DELETE'),
  async (req, res, next) => {
    try {
      if (isPostgresActive()) {
        await dbRun('DELETE FROM public.roads WHERE id = $1', [req.params.id]);
      } else {
        await dbRun('DELETE FROM roads WHERE id = ?', [req.params.id]);
      }
      return res.json({ success: true, message: 'تم حذف الطريق من قاعدة البيانات.' });
    } catch (e) {
      next(e);
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. فحوصات الرصفة (PMS Inspections)
═══════════════════════════════════════════════════════════════════════════ */
router.get(['/inspections', '/inspections/list'], rbacManager.verifyToken, async (req, res, next) => {
  try {
    if (isPostgresActive()) {
      const rows = await dbQuery(`
        SELECT COALESCE(pi.inspection_id, pi.id) as id, pi.*, r.name AS road_name, r.code AS road_code
        FROM public.pavement_inspections pi
        LEFT JOIN public.roads r ON pi.road_id = r.id
        ORDER BY pi.inspection_date DESC NULLS LAST
      `);
      return res.json({ success: true, data: rows });
    }
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.post('/inspections/save', rbacManager.verifyToken,
  rbacManager.requirePermission(['ROADS.PCI', 'TASKS.INSPECT', 'OBSERVATIONS.CREATE', 'ROADS.EDIT', 'ROADS.CREATE', 'TASKS.CREATE']),
  async (req, res, next) => {
    const { id, roadId, inspectionDate, pciScore, distressType, defectType, recommendation, recommendedAction, notes } = req.body;
    const inspId = id || await numberingEngine.generateNextId('pavement_inspections', { prefix: 'INSP' });
    const finalDistress = distressType || defectType || 'فحص دوري عام';
    const finalRec = recommendation || recommendedAction || 'صيانة عادية';
    const finalPci = parseFloat(pciScore) || 80;
    const finalDate = inspectionDate || new Date().toISOString().split('T')[0];

    try {
      if (isPostgresActive()) {
        await dbRun(`
          INSERT INTO public.pavement_inspections
            (inspection_id, road_id, inspection_date, pci_score, distress_type, defect_type, recommendation, recommended_action, inspector_id, inspector_name, notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [inspId, roadId, finalDate, finalPci, finalDistress, finalDistress, finalRec, finalRec, req.user?.id || 'U-001', req.user?.fullName || 'المهندس المشرف', notes || '']);
            
        // تحديث مؤشر رصف الطريق بعد الفحص
        if (roadId && pciScore) {
          await dbRun(`
            UPDATE public.roads 
            SET pci_score = $1, last_maintenance_date = $2, updated_at = NOW() 
            WHERE id = $3
          `, [finalPci, finalDate, roadId]);
        }
      }
      return res.json({ success: true, message: 'تم تسجيل الفحص وتحديث مؤشر رصف الطريق بنجاح.' });
    } catch (err) {
      console.error('Error saving pavement inspection:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.delete('/inspections/:id', rbacManager.verifyToken,
  rbacManager.requirePermission(['ROADS.DELETE', 'TASKS.DELETE']),
  async (req, res, next) => {
    try {
      if (isPostgresActive()) {
        await dbRun('DELETE FROM public.pavement_inspections WHERE id = $1 OR inspection_id = $1', [req.params.id]);
      } else {
        await dbRun('DELETE FROM pavement_inspections WHERE id = ? OR inspection_id = ?', [req.params.id, req.params.id]);
      }
      return res.json({ success: true, message: 'تم حذف تقرير الفحص بنجاح' });
    } catch (err) {
      next(err);
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   5. GIS Buffer Query
═══════════════════════════════════════════════════════════════════════════ */
router.post('/gis/buffer-search', rbacManager.verifyToken, async (req, res, next) => {
  const { lat, lng, radiusMeters } = req.body;
  try {
    const assets = await SpatialEngine.getBufferNearbyAssets(lat, lng, radiusMeters || 500);
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. Segments & Maintenance
═══════════════════════════════════════════════════════════════════════════ */
router.post('/segments/split', rbacManager.verifyToken, async (req, res, next) => {
  const { road_id, segmentLengthMeters } = req.body;
  try {
    const segments = await ChainageSegmentEngine.splitRoadIntoSegments(road_id, segmentLengthMeters);
    res.json({ success: true, count: segments.length, data: segments });
  } catch (err) {
    next(err);
  }
});

router.post('/maintenance', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const record = await MaintenanceHistoryEngine.recordMaintenanceWork(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


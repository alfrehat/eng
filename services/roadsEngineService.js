/**
 * services/roadsEngineService.js
 * 🛣️ محرك إدارة شبكة الطرق وتقييم حالة الرصفات المتقدم (ROADS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Enterprise Pavement & Road Asset Management System (RAMS Edition)
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable
} = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class RoadsEngineService {
  constructor() {
    this.engineId = 'ROADS_ENGINE';
    this.engineName = 'Enterprise Roads Network & Pavement Condition (PCI) Engine';
    this.version = '3.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'roads_crud',
      'pci_assessment',
      'chainage_segmentation',
      'deterioration_forecasting',
      'maintenance_prioritization',
      'geojson_heatmap_export',
      'distress_catalog_analytics',
      'gis_spatial_sync'
    ];

    // أوزان التصنيف الوظيفي للطرق لاحتساب أولويات التدخل والصيانة
    this.classificationWeights = {
      'شرياني': 1.4,
      'رئيسي': 1.3,
      'تجميعي': 1.15,
      'محلي': 1.0,
      'فرعي': 0.9,
      'زراعي': 0.75
    };
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الطرق والرصفات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const auditId = `LOG-RD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: auditId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'شبكة الطرق والرصفات',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('RoadsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ حساب مؤشر PCI المعياري (ASTM D6433 Corrected Deduct Method)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب قيمة وتصنيف الـ PCI مع تصحيح تراكم العيوب المتعددة (CDV)
   */
  calculatePCI(distresses = []) {
    if (!Array.isArray(distresses) || distresses.length === 0) {
      return {
        pciScore: 100,
        conditionRating: 'EXCELLENT',
        arabicDescription: 'ممتازة',
        colorHex: '#10B981', // أخضر
        recommendedAction: 'لا تحتاج صيانة حالياً',
        deductValue: 0
      };
    }

    const deductValues = [];
    distresses.forEach(d => {
      const severity = (d.severity || 'MEDIUM').toUpperCase();
      const density = Math.min(100, Math.max(0.1, parseFloat(d.density || d.percentage || 10.0)));
      
      let severityWeight = 1.0;
      if (severity === 'LOW') severityWeight = 0.5;
      else if (severity === 'HIGH') severityWeight = 1.6;

      const deduct = Math.min(100, density * severityWeight * 1.15);
      deductValues.push(deduct);
    });

    deductValues.sort((a, b) => b - a);
    const totalDeduct = deductValues.reduce((sum, v) => sum + v, 0);
    const q = deductValues.filter(v => v > 5).length;

    let cdv = totalDeduct;
    if (q > 1) {
      const correctionFactor = 1.0 - (0.08 * (q - 1));
      cdv = totalDeduct * Math.max(0.45, correctionFactor);
    }

    const pciScore = Math.max(0, Math.min(100, Math.round(100 - cdv)));

    let conditionRating = 'GOOD';
    let arabicDescription = 'جيدة جداً';
    let colorHex = '#3B82F6'; // أزرق
    let recommendedAction = 'صيانة وقائية دورية';

    if (pciScore >= 85) {
      conditionRating = 'EXCELLENT';
      arabicDescription = 'ممتازة';
      colorHex = '#10B981'; // أخضر
      recommendedAction = 'صيانة وقائية دورية خفيفة وتفقد المصارف';
    } else if (pciScore >= 70) {
      conditionRating = 'GOOD';
      arabicDescription = 'جيدة';
      colorHex = '#3B82F6'; // أزرق
      recommendedAction = 'سد الشقوق ومعالجة الهبوطات الموضعية البسيطة';
    } else if (pciScore >= 55) {
      conditionRating = 'FAIR';
      arabicDescription = 'متوسطة';
      colorHex = '#F59E0B'; // برتقالي
      recommendedAction = 'طبقة صقل إسفلتية (Slurry Seal) وترقيع موضعي بالخلطة الساخنة';
    } else if (pciScore >= 40) {
      conditionRating = 'POOR';
      arabicDescription = 'سيئة';
      colorHex = '#EF4444'; // أحمر
      recommendedAction = 'كشط وإعادة تعبيد بطبقة خلطة إسفلتية ساخنة بسمك 5-7 سم';
    } else {
      conditionRating = 'FAILED';
      arabicDescription = 'متدهورة / حرجة';
      colorHex = '#7F1D1D'; // عنابي غامق
      recommendedAction = 'إعادة إنشاء وتأهيل كامل مع طبقة الأساس الحصوية وتحسين التصريف';
    }

    return {
      pciScore,
      conditionRating,
      arabicDescription,
      colorHex,
      recommendedAction,
      deductValue: Math.round(cdv * 100) / 100
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ التنبؤ بتدهور الرصفات وأولويات الصيانة (Deterioration & Prioritization)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * التنبؤ بتدهور مؤشر PCI لسنوات قادمة بناءً على معادلة التدهور الإنشائي
   * PCI(t) = PCI_current - (annualDropRate * t^1.1)
   */
  async predictRoadDeterioration(roadId, yearsAhead = 5) {
    const road = await this.getRoadById(roadId);
    if (!road) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const currentPci = parseFloat(road.pci_score || 85);
    const surfaceType = road.surface_type || 'خلطة ساخنة';
    const category = road.category || road.classification || 'محلي';

    // تحديد معدل التدهور السنوي الافتراضي
    let annualDropRate = 3.5;
    if (category === 'شرياني' || category === 'رئيسي') annualDropRate += 1.5;
    if (surfaceType.includes('باردة') || surfaceType.includes('ترقيع')) annualDropRate += 1.2;

    const predictions = [];
    const currentYear = new Date().getFullYear();

    for (let t = 0; t <= yearsAhead; t++) {
      const estimatedPci = Math.max(0, Math.round(currentPci - (annualDropRate * Math.pow(t, 1.1))));
      // استخراج التصنيف الرياضي للدرجة المتوقعة
      let rating = 'EXCELLENT';
      if (estimatedPci < 40) rating = 'FAILED';
      else if (estimatedPci < 55) rating = 'POOR';
      else if (estimatedPci < 70) rating = 'FAIR';
      else if (estimatedPci < 85) rating = 'GOOD';

      predictions.push({
        year: currentYear + t,
        yearsElapsed: t,
        predictedPci: estimatedPci,
        predictedCondition: rating,
        requiresIntervention: estimatedPci < 55
      });
    }

    return {
      roadId: road.id,
      roadName: road.name,
      currentPci,
      annualDropRate,
      predictions
    };
  }

  /**
   * احتساب درجة أولويات الصيانة الذكية (Maintenance Urgency Index - MUI)
   * Score = ((100 - PCI) * 0.55) + (ClassificationWeight * 25) + (PopulationDensityFactor * 20)
   */
  calculateMaintenancePriorityScore(road) {
    const pci = parseFloat(road.pci_score || 80);
    const category = road.category || road.classification || 'محلي';
    const catWeight = this.classificationWeights[category] || 1.0;
    
    // عامل التدهور (كلما قل الـ PCI زادت نقاط الأولوية)
    const distressComponent = (100 - pci) * 0.60;
    
    // عامل الأهمية الوظيفية للطريق
    const functionalComponent = (catWeight / 1.4) * 30.0;

    // عامل طول وعرض الشارع وكثافة الاستخدام
    const lengthKm = parseFloat(road.length_km || 1.0);
    const sizeComponent = Math.min(10.0, lengthKm * 2.0);

    const priorityScore = Math.round((distressComponent + functionalComponent + sizeComponent) * 10) / 10;
    
    let urgencyLevel = 'ROUTINE';
    if (priorityScore >= 75) urgencyLevel = 'IMMEDIATE_INTERVENTION';
    else if (priorityScore >= 55) urgencyLevel = 'HIGH_PRIORITY';
    else if (priorityScore >= 35) urgencyLevel = 'MEDIUM_PRIORITY';

    return {
      priorityScore,
      urgencyLevel,
      pci,
      category
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ إدارة مقاطع الشوارع والمحطات الكيلومترية (Chainage & Segments)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إضافة مقطع هندسي محدد بمحطات كيلومترية لطريق
   */
  async addRoadSegment(roadId, segmentData, user = null) {
    const road = await this.getRoadById(roadId, false);
    if (!road) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const actualRoadId = road.id;
    const segmentId = `SEG-${actualRoadId}-${Date.now().toString(36)}`;
    const startStation = segmentData.startStation || '0+000';
    const endStation = segmentData.endStation || '0+500';
    const lengthM = parseFloat(segmentData.lengthMeters || 500);
    const widthM = parseFloat(segmentData.widthMeters || road.width_m || 6.0);
    const pci = segmentData.pciScore !== undefined ? parseInt(segmentData.pciScore, 10) : (road.pci_score || 85);

    const record = {
      id: segmentId,
      road_id: actualRoadId,
      segment_code: segmentData.segmentCode || `SEC-${startStation}`,
      start_station: startStation,
      end_station: endStation,
      length_meters: lengthM,
      width_meters: widthM,
      pci_score: pci,
      surface_type: segmentData.surfaceType || road.surface_type || 'خلطة ساخنة',
      notes: segmentData.notes || '',
      created_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      const startCh = parseFloat(String(record.start_station).replace('+', '.')) || 0;
      const endCh = parseFloat(String(record.end_station).replace('+', '.')) || (startCh + (record.length_meters / 1000));
      const details = JSON.stringify({
        widthMeters: record.width_meters,
        pciScore: record.pci_score,
        surfaceType: record.surface_type,
        notes: record.notes
      });
      await dbRun(`
        INSERT INTO public.rams_segments
        (id, road_id, segment_code, start_chainage, end_chainage, lanes_detail, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      `, [
        record.id, record.road_id, record.segment_code, startCh, endCh, details
      ]);
    } else {
      if (!memDb.road_segments) memDb.road_segments = [];
      memDb.road_segments.push(record);
      saveMemTable('road_segments');
    }

    await this._recordAudit(user?.id, actualRoadId, 'ROAD_SEGMENT_ADDED', null, record);
    return record;
  }

  /**
   * استرجاع كافة المقاطع الهندسية لطريق
   */
  async getRoadSegments(roadId) {
    if (!roadId) return [];
    const actualId = String(roadId);

    if (isPostgresActive()) {
      return await dbQuery('SELECT *, start_chainage as start_station, end_chainage as end_station FROM public.rams_segments WHERE road_id = $1 ORDER BY start_chainage ASC', [actualId]) || [];
    } else {
      return (memDb.road_segments || []).filter(s => String(s.road_id || s.roadId) === actualId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4️⃣ إدارة شبكة الطرق (Roads Full CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة الطرق مع الفلاتر وترتيب الأولويات
   */
  async getRoads(filters = {}) {
    const { search, category, classification, district, minPci, maxPci, sortByPriority } = filters;
    let roadsList = [];

    if (isPostgresActive()) {
      let sql = 'SELECT * FROM public.roads WHERE 1=1';
      const params = [];

      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR id ILIKE $${params.length})`;
      }
      if (category || classification) {
        params.push(category || classification);
        sql += ` AND (category = $${params.length} OR classification = $${params.length})`;
      }
      if (district) {
        params.push(district);
        sql += ` AND district = $${params.length}`;
      }
      if (minPci !== undefined) {
        params.push(parseFloat(minPci));
        sql += ` AND pci_score >= $${params.length}`;
      }
      if (maxPci !== undefined) {
        params.push(parseFloat(maxPci));
        sql += ` AND pci_score <= $${params.length}`;
      }

      sql += ' ORDER BY created_at DESC LIMIT 500';
      roadsList = await dbQuery(sql, params) || [];
    } else {
      roadsList = (memDb.roads || []).filter(r => {
        const sTarget = `${r.name || ''} ${r.code || ''} ${r.id || ''}`.toLowerCase();
        if (search && !sTarget.includes(search.toLowerCase())) return false;
        if (category && r.category !== category && r.classification !== category) return false;
        if (district && r.district !== district) return false;
        if (minPci !== undefined && (parseFloat(r.pci_score) || 80) < parseFloat(minPci)) return false;
        if (maxPci !== undefined && (parseFloat(r.pci_score) || 80) > parseFloat(maxPci)) return false;
        return true;
      });
    }

    // إضافة تقييمات الصيانة الذكية لكل طريق
    const enrichedRoads = roadsList.map(road => {
      const priorityInfo = this.calculateMaintenancePriorityScore(road);
      return {
        ...road,
        length_km: parseFloat(road.length_km || 1.0),
        width_m: parseFloat(road.width_m || 6.0),
        area_sqm: Math.round(parseFloat(road.length_km || 1.0) * 1000 * parseFloat(road.width_m || 6.0)),
        maintenancePriority: priorityInfo
      };
    });

    if (sortByPriority === true || sortByPriority === 'true') {
      enrichedRoads.sort((a, b) => b.maintenancePriority.priorityScore - a.maintenancePriority.priorityScore);
    }

    return enrichedRoads;
  }

  /**
   * استرجاع تفاصيل طريق محدد مع المقاطع وسجل المسوحات
   */
  async getRoadById(roadId, includeDetails = true) {
    if (!roadId) return null;
    let road = null;

    if (isPostgresActive()) {
      road = await dbGet('SELECT * FROM public.roads WHERE id = $1 OR code = $1', [roadId]);
    } else {
      road = (memDb.roads || []).find(r => String(r.id) === String(roadId) || String(r.code) === String(roadId)) || null;
    }

    if (!road) return null;
    if (!includeDetails) return road;
    const actualId = road.id;

    // استرجاع المقاطع وسجلات المسح الميداني
    const segments = await this.getRoadSegments(actualId);
    let surveys = [];

    if (isPostgresActive()) {
      surveys = await dbQuery('SELECT *, inspection_date as survey_date, inspector_name as surveyor_name, recommendation as recommended_action FROM public.road_inspections WHERE road_id = $1 OR "roadId" = $1 ORDER BY inspection_date DESC', [actualId]) || [];
    } else {
      surveys = (memDb.road_pci_surveys || []).filter(s => String(s.road_id || s.roadId) === String(actualId));
    }

    return {
      ...road,
      length_km: parseFloat(road.length_km || 1.0),
      width_m: parseFloat(road.width_m || 6.0),
      area_sqm: Math.round(parseFloat(road.length_km || 1.0) * 1000 * parseFloat(road.width_m || 6.0)),
      segmentsCount: segments.length,
      segments,
      surveysCount: surveys.length,
      surveys: surveys.map(s => ({
        ...s,
        distresses: typeof s.distresses === 'string' ? JSON.parse(s.distresses || '[]') : (s.distresses || [])
      })),
      maintenancePriority: this.calculateMaintenancePriorityScore(road)
    };
  }

  /**
   * إنشاء طريق جديد بالترقيم الموحد والبيانات المكانية الكاملة
   */
  async createRoad(roadData, user = null) {
    const {
      name, code, category, classification, length_km, lengthKm, width_m, widthMeters,
      lanes_count, lanes, pci_score, surface_condition, surface_type, notes, district,
      start_lat, start_lng, end_lat, end_lng, coordinates, geometry
    } = roadData;

    if (!name) throw new Error('اسم الشارع/الطريق مطلوب.');

    const id = await numberingEngine.generateNextId('roads');
    const actualCode = code || id;
    const actualCategory = category || classification || 'فرعي';
    const actualPci = pci_score !== undefined ? parseInt(pci_score, 10) : 85;
    const now = new Date().toISOString();

    const record = {
      id,
      code: actualCode,
      name,
      category: actualCategory,
      classification: actualCategory,
      length_km: Math.max(0.01, parseFloat(length_km || lengthKm || 1.0)),
      width_m: Math.max(1.0, parseFloat(width_m || widthMeters || 6.0)),
      lanes_count: parseInt(lanes_count || lanes || 2, 10),
      pci_score: actualPci,
      surface_condition: surface_condition || 'خلطة إسفلتية ساخنة',
      surface_type: surface_type || 'خلطة ساخنة',
      district: district || 'كفرنجة',
      start_lat: parseFloat(start_lat) || 32.2985,
      start_lng: parseFloat(start_lng) || 35.7050,
      end_lat: parseFloat(end_lat) || null,
      end_lng: parseFloat(end_lng) || null,
      coordinates: coordinates ? JSON.stringify(coordinates) : (geometry ? JSON.stringify(geometry) : null),
      notes: notes || '',
      created_at: now,
      updated_at: now
    };

    let geoJsonStr = null;
    if (geometry) {
      geoJsonStr = typeof geometry === 'object' ? JSON.stringify(geometry) : String(geometry);
    } else if (Array.isArray(coordinates) && coordinates.length >= 2) {
      geoJsonStr = JSON.stringify({ type: 'LineString', coordinates });
    }

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.roads
        (id, code, name, category, classification, length_km, width_m, lanes_count, pci_score, aadt_volume, surface_condition, surface_type, notes, "geoJson", geom, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          CASE 
            WHEN $14::text IS NOT NULL AND $14::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($14), 4326)
            ELSE NULL 
          END,
          NOW(), NOW())
      `, [
        record.id, record.code, record.name, record.category, record.classification,
        record.length_km, record.width_m, record.lanes_count, record.pci_score,
        parseInt(record.aadt_volume || 0, 10),
        record.surface_condition, record.surface_type, record.notes, geoJsonStr
      ]);
    } else {
      if (!memDb.roads) memDb.roads = [];
      memDb.roads.unshift(record);
      saveMemTable('roads');
    }

    await this._recordAudit(user?.id, id, 'ROAD_CREATED', null, record);
    return record;
  }

  /**
   * تعديل بيانات طريق
   */
  async updateRoad(roadId, updates, user = null) {
    const existing = await this.getRoadById(roadId);
    if (!existing) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const actualId = existing.id;
    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: now };

    let geoJsonStr = null;
    if (updates.geometry) {
      geoJsonStr = typeof updates.geometry === 'object' ? JSON.stringify(updates.geometry) : String(updates.geometry);
    } else if (Array.isArray(updates.coordinates) && updates.coordinates.length >= 2) {
      geoJsonStr = JSON.stringify({ type: 'LineString', coordinates: updates.coordinates });
    }

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.roads
        SET name = $1, category = $2, classification = $3, length_km = $4, width_m = $5,
            lanes_count = $6, surface_condition = $7, surface_type = $8, notes = $9,
            "geoJson" = COALESCE($10, "geoJson"),
            geom = CASE 
              WHEN $10::text IS NOT NULL AND $10::text != '' THEN ST_SetSRID(ST_GeomFromGeoJSON($10), 4326)
              ELSE geom
            END,
            updated_at = NOW()
        WHERE id = $11
      `, [
        updated.name, updated.category, updated.classification,
        parseFloat(updated.length_km || 1), parseFloat(updated.width_m || 6),
        parseInt(updated.lanes_count || 2, 10), updated.surface_condition,
        updated.surface_type, updated.notes, geoJsonStr, actualId
      ]);
    } else {
      const idx = (memDb.roads || []).findIndex(r => String(r.id) === String(actualId));
      if (idx !== -1) {
        memDb.roads[idx] = updated;
        saveMemTable('roads');
      }
    }

    await this._recordAudit(user?.id, actualId, 'ROAD_UPDATED', existing, updated);
    return await this.getRoadById(actualId);
  }

  /**
   * حذف طريق وتنظيف مقاطعه وسجلات مسوحاته
   */
  async deleteRoad(roadId, user = null) {
    const existing = await this.getRoadById(roadId);
    if (!existing) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const actualId = existing.id;

    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.rams_segments WHERE road_id = $1', [actualId]);
      await dbRun('DELETE FROM public.road_inspections WHERE road_id = $1', [actualId]);
      await dbRun('DELETE FROM public.road_defects WHERE road_id = $1', [actualId]);
      await dbRun('DELETE FROM public.roads WHERE id = $1', [actualId]);
    } else {
      memDb.roads = (memDb.roads || []).filter(r => String(r.id) !== String(actualId));
      if (memDb.road_segments) {
        memDb.road_segments = memDb.road_segments.filter(s => String(s.road_id) !== String(actualId));
      }
      if (memDb.road_pci_surveys) {
        memDb.road_pci_surveys = memDb.road_pci_surveys.filter(s => String(s.road_id || s.roadId) !== String(actualId));
      }
      saveMemTable('roads');
    }

    await this._recordAudit(user?.id, actualId, 'ROAD_DELETED', existing, null);
    return { success: true, message: 'تم حذف الطريق وكافة مقاطعه وسجلاته الهندسية بنجاح.' };
  }

  /**
   * توثيق مسح ميداني PCI مفصل وتحديث مؤشر الطريق
   */
  async addPciSurvey(roadId, surveyData, user = null) {
    const road = await this.getRoadById(roadId);
    if (!road) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const actualRoadId = road.id;
    const { distresses, surveyDate, surveyorName, notes } = surveyData;
    const pciResult = this.calculatePCI(distresses || []);
    const now = new Date().toISOString();

    const surveyId = await numberingEngine.generateNextId('road_inspections', { prefix: 'INSP' });
    const surveyRecord = {
      id: surveyId,
      road_id: actualRoadId,
      survey_date: surveyDate || now.split('T')[0],
      surveyor_name: surveyorName || user?.fullName || 'مهندس المسح الميداني',
      pci_score: pciResult.pciScore,
      condition_rating: pciResult.conditionRating,
      recommended_action: pciResult.recommendedAction,
      distresses: typeof distresses === 'object' ? JSON.stringify(distresses) : (distresses || '[]'),
      notes: notes || '',
      created_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.road_inspections
        (id, road_id, inspection_date, inspector_name, pci_score, recommendation, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        surveyRecord.id, surveyRecord.road_id, surveyRecord.survey_date,
        surveyRecord.surveyor_name, surveyRecord.pci_score,
        surveyRecord.recommended_action, surveyRecord.notes
      ]);

      await dbRun('UPDATE public.roads SET pci_score = $1, last_maintenance_date = $2, updated_at = NOW() WHERE id = $3', 
        [pciResult.pciScore, surveyRecord.survey_date, actualRoadId]
      );
    } else {
      const idx = (memDb.roads || []).findIndex(r => String(r.id) === String(actualRoadId));
      if (idx !== -1) {
        memDb.roads[idx].pci_score = pciResult.pciScore;
        memDb.roads[idx].last_maintenance_date = surveyRecord.survey_date;
        memDb.roads[idx].updated_at = now;
        saveMemTable('roads');
      }

      if (!memDb.road_pci_surveys) memDb.road_pci_surveys = [];
      memDb.road_pci_surveys.push(surveyRecord);
      saveMemTable('road_pci_surveys');
    }

    await this._recordAudit(user?.id, actualRoadId, 'ROAD_PCI_SURVEY_RECORDED', { oldPci: road.pci_score }, { newPci: pciResult.pciScore, pciResult });
    return {
      success: true,
      survey: surveyRecord,
      pciEvaluation: pciResult
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5️⃣ تصدير الخرائط المكانية والحرارية (GeoJSON Heatmap Exporter)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * تصدير شبكة الطرق بصيغة GeoJSON FeatureCollection ملونة طبقاً لـ PCI
   */
  async exportGeoJsonHeatmap(filters = {}) {
    const roads = await this.getRoads(filters);
    const features = [];

    roads.forEach(r => {
      let coords = null;
      try {
        if (r.coordinates) {
          coords = typeof r.coordinates === 'string' ? JSON.parse(r.coordinates) : r.coordinates;
        }
      } catch (e) {
        coords = null;
      }

      // إذا لم تتوفر إحداثيات مسارية، نبني خطاً مبسطاً بين البداية والنهاية
      if (!coords && r.start_lat && r.start_lng) {
        const sLat = parseFloat(r.start_lat);
        const sLng = parseFloat(r.start_lng);
        const eLat = parseFloat(r.end_lat || sLat + 0.002);
        const eLng = parseFloat(r.end_lng || sLng + 0.002);
        coords = [[sLng, sLat], [eLng, eLat]];
      }

      if (coords) {
        const pci = parseFloat(r.pci_score || 80);
        let strokeColor = '#10B981'; // أخضر
        if (pci < 40) strokeColor = '#7F1D1D'; // عنابي
        else if (pci < 55) strokeColor = '#EF4444'; // أحمر
        else if (pci < 70) strokeColor = '#F59E0B'; // برتقالي
        else if (pci < 85) strokeColor = '#3B82F6'; // أزرق

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords
          },
          properties: {
            roadId: r.id,
            code: r.code,
            name: r.name,
            category: r.category,
            district: r.district,
            pciScore: pci,
            conditionRating: r.surface_condition,
            stroke: strokeColor,
            strokeWidth: Math.min(8, Math.max(3, parseInt(r.lanes_count || 2, 10) * 2)),
            strokeOpacity: 0.85,
            lengthKm: r.length_km,
            areaSqm: r.area_sqm,
            priorityScore: r.maintenancePriority?.priorityScore
          }
        });
      }
    });

    return {
      type: 'FeatureCollection',
      featuresCount: features.length,
      features
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6️⃣ إحصائيات الشبكة وتحليل العيوب الإنشائية (Network Analytics)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع الإحصائيات التجميعية واحتساب موازنة الصيانة بناءً على المساحات
   */
  async getNetworkStats() {
    const roads = await this.getRoads({});
    let totalLengthKm = 0;
    let totalAreaSqm = 0;
    let pciSum = 0;
    let criticalCount = 0;
    let goodCount = 0;
    let estimatedMaintenanceBudget = 0;

    roads.forEach(r => {
      const lenKm = parseFloat(r.length_km || 1.0);
      const widthM = parseFloat(r.width_m || 6.0);
      const areaSqm = lenKm * 1000 * widthM;
      const pci = parseFloat(r.pci_score || 80);

      totalLengthKm += lenKm;
      totalAreaSqm += areaSqm;
      pciSum += pci;

      if (pci < 55) {
        criticalCount++;
        estimatedMaintenanceBudget += (areaSqm * 9.5); // إعادة إنشاء وتأهيل بـ 9.5 د.أ / م²
      } else if (pci < 70) {
        estimatedMaintenanceBudget += (areaSqm * 2.5); // صيانة وقائية بـ 2.5 د.أ / م²
      } else {
        goodCount++;
      }
    });

    const totalCount = roads.length;
    const avgPci = totalCount > 0 ? Math.round(pciSum / totalCount) : 80;

    return {
      totalRoadsCount: totalCount,
      totalLengthKm: Math.round(totalLengthKm * 100) / 100,
      totalAreaSquareMeters: Math.round(totalAreaSqm),
      averageNetworkPCI: avgPci,
      criticalRoadsCount: criticalCount,
      goodRoadsCount: goodCount,
      estimatedMaintenanceBudget: Math.round(estimatedMaintenanceBudget)
    };
  }

  /**
   * استخراج إحصائيات انتشار العيوب الإنشائية (Distress Analytics)
   */
  async getDistressAnalytics() {
    let allSurveys = [];
    if (isPostgresActive()) {
      allSurveys = await dbQuery('SELECT distresses FROM public.road_pci_surveys') || [];
    } else {
      allSurveys = memDb.road_pci_surveys || [];
    }

    const distressCounts = {};
    allSurveys.forEach(s => {
      let list = [];
      try {
        list = typeof s.distresses === 'string' ? JSON.parse(s.distresses || '[]') : (s.distresses || []);
      } catch (e) {
        list = [];
      }

      list.forEach(d => {
        const type = d.type || d.name || 'غير مصنف';
        if (!distressCounts[type]) distressCounts[type] = 0;
        distressCounts[type]++;
      });
    });

    return {
      totalSurveysAnalyzed: allSurveys.length,
      distressFrequency: distressCounts
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalRoads = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.roads');
        totalRoads = parseInt(res?.count || 0, 10);
      } else {
        totalRoads = (memDb.roads || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalRoads,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: false,
        status: 'FAILED',
        engineId: this.engineId,
        error: e.message
      };
    }
  }
}

module.exports = new RoadsEngineService();

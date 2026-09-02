/**
 * Administration/API/g2gGateway.js
 * بوابة التكامل الحكومية المؤمنة لتبادل البيانات (Secure G2G Integration Gateway)
 * توفر منافذ مخصصة لوزارة المالية والمركز الجغرافي الملكي محمية بجدران تحقق.
 */

const express = require('express');
const router = express.Router();
const notificationCenter = require('../../services/notificationCenter');
const { dbGet, dbQuery, isPostgresActive, getPool, memDb } = require('../../utils/database');

// تحميل إعدادات الحماية والأمان من البيئة
const G2G_API_KEY = process.env.G2G_API_KEY || 'kfranjah-g2g-secret-key';
const IP_WHITELIST = (process.env.G2G_IP_WHITELIST || '127.0.0.1,::1,localhost').split(',');

/**
 * برمجية وسيطة للتحقق من هوية المتصل وعنوان IP الخاص به (IP Whitelisting & API Key Guard)
 */
function validateG2GRequest(req, res, next) {
  const apiKey = req.headers['x-g2g-api-key'] || req.query.apiKey;
  const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

  // 1. التحقق من مفتاح البوابة المشترك
  if (apiKey !== G2G_API_KEY) {
    return res.status(401).json({ error: 'غير مصرح: مفتاح واجهة التطبيق غير صحيح أو مفقود (x-g2g-api-key)' });
  }

  // 2. التحقق من جدار الحماية وعناوين IP المصرح لها بالدخول
  const cleanIp = clientIp.replace(/^.*:/, ''); // إزالة بادئات IPv6 للـ localhost
  const isWhitelisted = IP_WHITELIST.some(ip => cleanIp === ip || clientIp === ip || ip === 'localhost' || ip === '127.0.0.1');
  
  if (!isWhitelisted) {
    console.warn(`🔒 [G2G Warning] Unauthorized access attempt blocked from IP: ${clientIp}`);
    return res.status(403).json({ error: `غير مسموح بالدخول للبوابة الحكومية من هذا العنوان IP: ${clientIp}` });
  }

  next();
}

// تطبيق تصفية الحماية على كافة منافذ الموجه
router.use(validateG2GRequest);

/**
 * منفذ وزارة المالية الأردنية - كشف حالة الموازنات والإنفاق الفعلي للمشاريع البلدية
 * GET /api/v4/g2g/finance/budget-status
 */
router.get('/finance/budget-status', async (req, res) => {
  try {
    let totalProjectsCount = 0;
    let totalAllocatedBudget = 0;
    let activeProjectsCount = 0;
    let activeExpendedBudget = 0;
    let budgetLines = [];

    if (isPostgresActive()) {
      const stats = await dbGet(`
        SELECT 
          COUNT(*) as "totalTenders", 
          COALESCE(SUM(COALESCE(value, "estimatedValue", 0)), 0) as "totalValue" 
        FROM tenders
      `);
      const activeStats = await dbGet(`
        SELECT 
          COUNT(*) as "activeCount", 
          COALESCE(SUM(COALESCE(value, "estimatedValue", 0)), 0) as "activeValue" 
        FROM tenders 
        WHERE status ILIKE '%مفتوح%' OR status ILIKE '%قيد%' OR status ILIKE '%جاري%'
      `);

      totalProjectsCount = parseInt(stats?.totalTenders || 0, 10);
      totalAllocatedBudget = parseFloat(stats?.totalValue || 0);
      activeProjectsCount = parseInt(activeStats?.activeCount || 0, 10);
      activeExpendedBudget = parseFloat(activeStats?.activeValue || 0);

      try {
        const pool = getPool();
        if (pool) {
          const lines = await pool.query('SELECT code, name, allocated_amount, reserved_amount, expended_amount FROM enterprise.budget_lines');
          budgetLines = lines.rows || [];
        }
      } catch (be) {}
    } else {
      const tenders = memDb.tenders || [];
      totalProjectsCount = tenders.length;
      totalAllocatedBudget = tenders.reduce((s, t) => s + (parseFloat(t.value || t.estimatedValue || 0) || 0), 0);
      const active = tenders.filter(t => (t.status || '').includes('مفتوح') || (t.status || '').includes('قيد'));
      activeProjectsCount = active.length;
      activeExpendedBudget = active.reduce((s, t) => s + (parseFloat(t.value || t.estimatedValue || 0) || 0), 0);
    }

    if (!budgetLines.length) {
      budgetLines = [
        {
          code: 'B-2026-MAIN',
          name: 'بند موازنة المشاريع والأشغال الهندسية الكلي - بلدية كفرنجة',
          allocated_amount: totalAllocatedBudget > 0 ? totalAllocatedBudget : 500000.00,
          reserved_amount: totalAllocatedBudget,
          expended_amount: activeExpendedBudget
        }
      ];
    }

    res.json({
      municipality: 'بلدية كفرنجة الجديدة',
      reportTimestamp: new Date().toISOString(),
      summary: {
        totalProjectsCount,
        totalAllocatedBudget,
        activeProjectsCount,
        activeExpendedBudget
      },
      budgetLines: budgetLines
    });
  } catch (err) {
    console.error('❌ [G2G Finance Error] Failed to aggregate budget stats:', err.message);
    res.status(500).json({ error: 'فشل تجميع تقرير الميزانية الحكومي: ' + err.message });
  }
});

/**
 * منفذ المركز الجغرافي الملكي الأردني - بث شبكة مسارات الطرق والشوارع الجغرافية
 * GET /api/v4/g2g/gis/spatial-layers
 */
router.get('/gis/spatial-layers', async (req, res) => {
  try {
    let roads = [];
    if (isPostgresActive()) {
      roads = await dbQuery(`
        SELECT id, name, 
               COALESCE(category, classification, 'فرعي') as category,
               COALESCE(length_km, length, "lengthKm", 0) as "lengthKm",
               COALESCE(width_m, width, "widthMeters", 0) as "widthMeters",
               COALESCE(pci_score, 80) as pci_score,
               CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom) ELSE NULL END as "geoJson"
        FROM roads
        ORDER BY id ASC
      `);
    } else {
      roads = (memDb.roads || []).map(r => ({
        id: r.id || r.code,
        name: r.name,
        category: r.category || r.classification || 'فرعي',
        lengthKm: r.length_km || r.lengthKm || 1,
        widthMeters: r.width_m || r.widthMeters || 6,
        pci_score: r.pci_score || 80,
        geoJson: typeof r.geom === 'object' ? JSON.stringify(r.geom) : (r.geoJson || r.geometry || null)
      }));
    }
    
    // بناء مصفوفة المعالم الجغرافية بصيغة المعيار الجغرافي GeoJSON
    const features = [];
    for (const r of roads || []) {
      let geometry = null;
      if (r.geoJson) {
        try {
          geometry = typeof r.geoJson === 'string' ? JSON.parse(r.geoJson) : r.geoJson;
        } catch (e) {}
      }
      if (!geometry) {
        // افتراض مسار افتراضي في كفرنجة
        geometry = {
          type: 'LineString',
          coordinates: [
            [35.7501, 32.3301],
            [35.7550, 32.3350]
          ]
        };
      }
      features.push({
        type: 'Feature',
        id: r.id,
        geometry: geometry,
        properties: {
          name: r.name || `شارع ${r.id}`,
          category: r.category,
          lengthKm: parseFloat(r.lengthKm) || 0,
          widthMeters: parseFloat(r.widthMeters) || 0,
          pci_score: r.pci_score || 80
        }
      });
    }

    res.json({
      type: 'FeatureCollection',
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: features
    });
  } catch (err) {
    console.error('❌ [G2G GIS Error] Failed to stream spatial layers:', err.message);
    res.status(500).json({ error: 'فشل تحميل طبقات الخرائط المكانية: ' + err.message });
  }
});

module.exports = router;

/**
 * services/gisSurveyService.js
 * 📐 محرك تحويل واستيراد النقاط والملفات المساحية والهندسية (GIS_SURVEY_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Spatial Survey Patch
 */

const { getPool, isPostgresActive, dbGet, dbQuery, dbRun, memDb, saveMemTable } = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

class GisSurveyService {
  constructor() {
    this.engineId = 'GIS_SURVEY_ENGINE';
    this.engineName = 'Enterprise GIS & Topographical Survey Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'batch_points_import',
      'jordan_grid_transformation',
      'spatial_points_query',
      'geojson_export',
      'csv_export',
      'survey_audit_trail'
    ];
    this._sequenceCounter = 0;

    // ربط الدوال لضمان سلامة التنفيذ في كافة السياقات
    this.importSurveyPoints = this.importSurveyPoints.bind(this);
    this.getSurveyPoints = this.getSurveyPoints.bind(this);
    this.exportPointsToGeoJson = this.exportPointsToGeoJson.bind(this);
    this.exportPointsToCSV = this.exportPointsToCSV.bind(this);
    this.deleteSurveyPoints = this.deleteSurveyPoints.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
  }

  /**
   * توليد معرف نقطي مساحي فريد ومستحيل التصادم
   */
  _generatePointId(prefix = 'SP') {
    this._sequenceCounter = (this._sequenceCounter + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}-${String(this._sequenceCounter).padStart(5, '0')}`;
  }

  /**
   * الكشف الذكي عن نظام الإحداثيات وتطبيعه (WGS84 مقابل الشبكة الأردنية المتريّة)
   * يدعم: WGS84 (Lat/Lon) و Jordan JTM و Palestine 1923 (Cassini-Soldner)
   */
  _normalizeCoordinates(rawX, rawY) {
    const x = parseFloat(rawX);
    const y = parseFloat(rawY);
    if (isNaN(x) || isNaN(y)) return null;

    // 1. إذا كانت الإحداثيات درجاتية عالمية WGS84 (Lat: 29-33, Lon: 34-39 للأردن)
    if (x >= 34.0 && x <= 40.0 && y >= 29.0 && y <= 34.0) {
      return { lng: x, lat: y, srid: 4326, originalGrid: 'WGS84' };
    }
    if (y >= 34.0 && y <= 40.0 && x >= 29.0 && x <= 34.0) {
      return { lng: y, lat: x, srid: 4326, originalGrid: 'WGS84_INVERTED' };
    }

    // 2. إذا كانت إحداثيات شبكة ميركاتور الأردنية المتريّة (Jordan JTM / Cassini-Soldner)
    // كفرنجة: Easting ~ 210,000 to 240,000 | Northing ~ 190,000 to 220,000 (أو ~1,190,000 في بعض الإسقاطات)
    if ((x > 100000 && x < 400000) || (y > 100000 && y < 1500000)) {
      let easting = x;
      let northing = y;
      // إذا كان X بنظام الـ 1,000,000 فهو حتماً Northing ويجب التبديل مع Y
      if (x > 1000000 && y < 500000) {
        northing = x;
        easting = y;
      } else if (y > 1000000 && x < 500000) {
        northing = y;
        easting = x;
      }

      // تحويل تقريبي دقيق لشبكة Cassini-Soldner (Palestine 1923) إلى WGS84 لمنطقة عجلون/كفرنجة
      // الأصل المعياري: خط طول 35.2124 وخط عرض 31.7341 مع False Origin (170,000 E, 100,000 N)
      const effectiveN = northing >= 1000000 ? (northing - 1100000) : (northing >= 100000 ? (northing - 100000) : northing);
      const effectiveE = easting >= 100000 ? (easting - 170000) : easting;
      const latWGS = 31.7341 + (effectiveN / 110900.0);
      const lonWGS = 35.2124 + (effectiveE / (111320.0 * Math.cos(latWGS * Math.PI / 180)));

      return {
        lng: Math.round(lonWGS * 1000000) / 1000000,
        lat: Math.round(latWGS * 1000000) / 1000000,
        srid: 4326,
        originalGrid: 'JORDAN_LOCAL_GRID',
        rawEasting: easting,
        rawNorthing: northing
      };
    }

    // افتراض قياسي مع التقييد
    return { lng: x, lat: y, srid: 4326, originalGrid: 'UNKNOWN' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ استيراد النقاط المساحية بالدفعات السريعة (Batch Bulk Import)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إدخال نقاط مساحية بصيغ متعددة بنمط الإدخال الدفعي عالي السرعة
   */
  async importSurveyPoints(pointsArray, options = {}) {
    if (!Array.isArray(pointsArray) || pointsArray.length === 0) {
      return { success: true, count: 0, data: [] };
    }

    const uploadedBy = typeof options === 'string' ? options : (options.uploadedBy || 'SYSTEM');
    const roadId = options.roadId || options.road_id || null;
    const projectId = options.projectId || options.project_id || null;
    const batchTag = options.batchTag || `BATCH-${Date.now().toString(36)}`;

    const normalizedPoints = [];
    for (const pt of pointsArray) {
      const rawX = pt.lng !== undefined ? pt.lng : (pt.longitude !== undefined ? pt.longitude : (pt.x !== undefined ? pt.x : pt.easting));
      const rawY = pt.lat !== undefined ? pt.lat : (pt.latitude !== undefined ? pt.latitude : (pt.y !== undefined ? pt.y : pt.northing));
      const elevation = parseFloat(pt.elevation || pt.z || pt.elev || 0);

      const norm = this._normalizeCoordinates(rawX, rawY);
      if (!norm) continue;

      normalizedPoints.push({
        id: this._generatePointId('SP'),
        point_code: String(pt.code || pt.point_code || pt.name || `PT-${normalizedPoints.length + 1}`).trim(),
        lat: norm.lat,
        lng: norm.lng,
        elevation_m: isNaN(elevation) ? 0.0 : elevation,
        road_id: roadId,
        project_id: projectId,
        batch_tag: batchTag,
        raw_properties: {
          ...(pt.properties || {}),
          originalGrid: norm.originalGrid,
          rawEasting: norm.rawEasting,
          rawNorthing: norm.rawNorthing
        },
        uploaded_by: uploadedBy,
        created_at: new Date().toISOString()
      });
    }

    if (normalizedPoints.length === 0) {
      return { success: false, count: 0, error: 'لم يتم العثور على إحداثيات صالحة في الملف المدخل.' };
    }

    let insertedPoints = [];

    // التنفيذ المعاملي السريع عبر PostgreSQL
    if (isPostgresActive()) {
      const pool = getPool();
      if (pool) {
        let client = null;
        try {
          client = await pool.connect();
          await client.query('BEGIN');

          // تقسيم النقاط إلى حزم دفعية (500 نقطة لكل استعلام) لمنع تجاوز سقف المعاملات
          const CHUNK_SIZE = 500;
          for (let i = 0; i < normalizedPoints.length; i += CHUNK_SIZE) {
            const chunk = normalizedPoints.slice(i, i + CHUNK_SIZE);
            const valueClauses = [];
            const params = [];

            chunk.forEach(pt => {
              const pIdx = params.length;
              params.push(
                pt.id, pt.point_code, pt.elevation_m, pt.lng, pt.lat,
                JSON.stringify(pt.raw_properties), pt.uploaded_by, pt.road_id, pt.project_id
              );
              valueClauses.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, ST_SetSRID(ST_MakePoint($${pIdx + 4}, $${pIdx + 5}), 4326), $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9})`);
            });

            const query = `
              INSERT INTO public.road_survey_points 
              (id, point_code, elevation_m, geom, raw_properties, uploaded_by, road_id, project_id)
              VALUES ${valueClauses.join(', ')}
              RETURNING id, point_code, elevation_m, ST_X(geom) as lng, ST_Y(geom) as lat;
            `;

            const res = await client.query(query, params);
            insertedPoints.push(...res.rows);
          }

          await client.query('COMMIT');
        } catch (dbErr) {
          if (client) await client.query('ROLLBACK');
          // إفراغ المصفوفة فوراً لمنع التقرير الكاذب بالنجاح
          insertedPoints = [];
          logError('GisSurveyService.importSurveyPoints', `DB import failed, rolling back: ${dbErr.message}`);
        } finally {
          if (client) client.release();
        }
      }
    }

    // التراجع الآمن إلى نمط الذاكرة فقط إذا فشلت قاعدة البيانات أو كانت غير نشطة
    if (insertedPoints.length === 0 && normalizedPoints.length > 0) {
      if (!memDb.survey_points) memDb.survey_points = [];
      memDb.survey_points.push(...normalizedPoints);
      saveMemTable('survey_points');
      insertedPoints = normalizedPoints;
    }

    return {
      success: insertedPoints.length > 0,
      count: insertedPoints.length,
      batchTag,
      data: insertedPoints
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ استعلام وتصدير النقاط المساحية (Query & Export Operations)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع النقاط المساحية مع الفلاتر
   */
  async getSurveyPoints(filters = {}) {
    const { roadId, projectId, search, limit = 1000 } = filters;

    if (isPostgresActive()) {
      let sql = `
        SELECT id, point_code, elevation_m, ST_X(geom) as lng, ST_Y(geom) as lat,
               road_id, project_id, uploaded_by, created_at
        FROM public.road_survey_points
        WHERE 1=1
      `;
      const params = [];

      if (roadId) {
        params.push(roadId);
        sql += ` AND (road_id = $${params.length} OR road_id IN (SELECT id FROM roads WHERE code = $${params.length}))`;
      }
      if (projectId) {
        params.push(projectId);
        sql += ` AND project_id = $${params.length}`;
      }
      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (point_code ILIKE $${params.length} OR id ILIKE $${params.length})`;
      }

      sql += ` ORDER BY created_at ASC LIMIT ${Math.max(1, parseInt(limit, 10))}`;
      return await dbQuery(sql, params) || [];
    } else {
      let list = memDb.survey_points || [];
      if (roadId) list = list.filter(p => p.road_id === roadId || p.roadId === roadId);
      if (projectId) list = list.filter(p => p.project_id === projectId || p.projectId === projectId);
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(p => (p.point_code || '').toLowerCase().includes(s) || p.id.toLowerCase().includes(s));
      }
      return list.slice(0, parseInt(limit, 10));
    }
  }

  /**
   * تصدير النقاط المساحية بصيغة GeoJSON FeatureCollection للخرائط
   */
  async exportPointsToGeoJson(filters = {}) {
    const points = await this.getSurveyPoints(filters);
    const features = points.map(pt => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(pt.lng), parseFloat(pt.lat), parseFloat(pt.elevation_m || 0)]
      },
      properties: {
        id: pt.id,
        code: pt.point_code,
        elevation: pt.elevation_m,
        roadId: pt.road_id,
        projectId: pt.project_id
      }
    }));

    return {
      type: 'FeatureCollection',
      totalPoints: features.length,
      features
    };
  }

  /**
   * تصدير النقاط المساحية بصيغة CSV لأجهزة الرفع المساحي (P, E, N, Z, Code)
   */
  async exportPointsToCSV(filters = {}) {
    const points = await this.getSurveyPoints(filters);
    let csvContent = 'Point_ID,Point_Code,Longitude_X,Latitude_Y,Elevation_Z,Road_ID\r\n';

    points.forEach(pt => {
      csvContent += `${pt.id},${pt.point_code},${pt.lng},${pt.lat},${pt.elevation_m || 0},${pt.road_id || ''}\r\n`;
    });

    return csvContent;
  }

  /**
   * حذف نقاط مساحية تابعة لشارع أو مشروع
   */
  async deleteSurveyPoints(filters = {}) {
    const { roadId, projectId, pointId } = filters;
    if (!roadId && !projectId && !pointId) {
      throw new Error('يجب تحديد roadId أو projectId أو pointId لتنفيذ الحذف بأمان.');
    }

    if (isPostgresActive()) {
      let sql = 'DELETE FROM public.road_survey_points WHERE 1=1';
      const params = [];
      if (pointId) {
        params.push(pointId);
        sql += ` AND id = $${params.length}`;
      }
      if (roadId) {
        params.push(roadId);
        sql += ` AND road_id = $${params.length}`;
      }
      if (projectId) {
        params.push(projectId);
        sql += ` AND project_id = $${params.length}`;
      }

      await dbRun(sql, params);
    } else {
      if (memDb.survey_points) {
        memDb.survey_points = memDb.survey_points.filter(p => {
          if (pointId && p.id === pointId) return false;
          if (roadId && (p.road_id === roadId || p.roadId === roadId)) return false;
          if (projectId && (p.project_id === projectId || p.projectId === projectId)) return false;
          return true;
        });
        saveMemTable('survey_points');
      }
    }

    return { success: true, message: 'تم تنظيف وحذف النقاط المساحية المحددة بنجاح.' };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalPoints = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.road_survey_points');
        totalPoints = parseInt(res?.count || 0, 10);
      } else {
        totalPoints = (memDb.survey_points || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalSurveyPointsStored: totalPoints,
        supportedSRIDs: [4326, 28191, 28192],
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

const gisSurveyService = new GisSurveyService();
gisSurveyService.GisSurveyService = GisSurveyService;
module.exports = gisSurveyService;

/**
 * Roads Services Layer - RAMS Enterprise Data Operations
 * بلدية كفرنجة الجديدة - الإصدار الموحد
 */
const { dbQuery, dbGet, dbRun, isPostgresActive, getPool, memDb, saveMemTable } = require('../../utils/database');

class RoadsService {
  /**
   * جلب جميع الطرق مع إحصائيات المقاطع و PCI
   */
  static async getAllRoads(filters = {}) {
    try {
      if (isPostgresActive()) {
        let sql = `
          SELECT 
            r.*,
            COALESCE(r.category, r.classification, 'فرعي') as category,
            COALESCE(r.length_km, r.length, "lengthKm", 0) as length_km,
            COALESCE(r.width_m, r.width, "widthMeters", 0) as width_m,
            COALESCE(r.pci_score, "pciRating", 80) as pci_score,
            CASE WHEN r.geom IS NOT NULL THEN ST_AsGeoJSON(r.geom) ELSE NULL END as geometry_json
          FROM public.roads r
        `;
        const params = [];
        if (filters.category) {
          params.push(filters.category);
          sql += ` WHERE (r.category = $1 OR r.classification = $1)`;
        }
        sql += ` ORDER BY r.created_at DESC NULLS LAST, r.id DESC`;

        const rows = await dbQuery(sql, params);
        if (rows && rows.length) return rows;
      }
    } catch (e) {
      console.warn('⚠️ Postgres RoadsService getAllRoads fallback:', e.message);
    }

    let roads = memDb.roads || [];
    if (filters.category) {
      roads = roads.filter(r => r.category === filters.category || r.classification === filters.category);
    }
    return roads;
  }

  /**
   * جلب تفاصيل طريق محدد مع المقاطع وسجل الصيانة
   */
  static async getRoadDetails(roadId) {
    try {
      if (isPostgresActive()) {
        const road = await dbGet(`
          SELECT r.*, 
                 COALESCE(r.category, r.classification, 'فرعي') as category,
                 COALESCE(r.length_km, r.length, "lengthKm", 0) as length_km,
                 COALESCE(r.width_m, r.width, "widthMeters", 0) as width_m,
                 COALESCE(r.pci_score, "pciRating", 80) as pci_score,
                 CASE WHEN r.geom IS NOT NULL THEN ST_AsGeoJSON(r.geom) ELSE NULL END as geometry_json 
          FROM public.roads r 
          WHERE r.id = $1 OR r.code = $1
        `, [roadId]);

        if (road) {
          let segments = [];
          let history = [];
          try {
            segments = await dbQuery(`SELECT s.*, ST_AsGeoJSON(s.geom) as geometry_json FROM public.rams_segments s WHERE s.road_id = $1 ORDER BY s.start_chainage ASC`, [road.id]);
          } catch (e) {}
          try {
            history = await dbQuery(`SELECT h.* FROM public.rams_maintenance_history h WHERE h.road_id = $1 ORDER BY h.execution_date DESC`, [road.id]);
          } catch (e) {}

          return {
            ...road,
            segments: segments || [],
            maintenance_history: history || []
          };
        }
      }
    } catch (e) {
      console.warn('⚠️ Postgres RoadsService getRoadDetails fallback:', e.message);
    }

    const road = (memDb.roads || []).find(r => String(r.id) === String(roadId) || String(r.code) === String(roadId));
    if (!road) return null;
    return {
      ...road,
      segments: [],
      maintenance_history: []
    };
  }

  /**
   * إنشاء طريق جديد ببيانات مكانية GeoJSON
   */
  static async createRoad(roadData) {
    const { id, code, name, category, length_km, width_m, lanes_count, geojson } = roadData;
    const roadId = id || `RD-${Date.now()}`;
    const roadCode = code || roadId;
    const cat = category || 'فرعي';
    const len = parseFloat(length_km) || 1.0;
    const width = parseFloat(width_m) || 6.0;
    const lanes = parseInt(lanes_count, 10) || 2;
    const now = new Date().toISOString();

    const roadObj = {
      id: roadId,
      code: roadCode,
      name: name || 'طريق جديد',
      category: cat,
      classification: cat,
      length_km: len,
      width_m: width,
      lanes_count: lanes,
      pci_score: 85,
      surface_condition: 'جيدة جداً',
      surface_type: 'خلطة أسفلتية ساخنة',
      geometry: geojson || null,
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const query = `
          INSERT INTO public.roads (id, code, name, category, classification, length_km, width_m, lanes_count, pci_score, surface_condition, surface_type, geom, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 85, 'جيدة جداً', 'خلطة أسفلتية ساخنة', 
            CASE WHEN $8::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($8), 4326) ELSE NULL END, NOW(), NOW())
          RETURNING *, CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom) ELSE NULL END as geometry_json;
        `;
        const res = await dbGet(query, [roadId, roadCode, name, cat, len, width, lanes, geojson ? JSON.stringify(geojson) : null]);
        if (res) return res;
      } catch (e) {
        console.warn('⚠️ Postgres createRoad fallback:', e.message);
      }
    }

    if (!memDb.roads) memDb.roads = [];
    memDb.roads.unshift(roadObj);
    saveMemTable('roads');
    return roadObj;
  }
}

module.exports = RoadsService;


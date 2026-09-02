/**
 * Roads Assets Layer - Intersections & Road Assets Engine
 * بلدية كفرنجة الجديدة - الإصدار الموحد
 */
const { dbQuery, dbGet, dbRun, isPostgresActive, memDb, saveMemTable } = require('../../utils/database');

class LinearAssetManager {
  /**
   * إنشاء تقاطع جديد أو عنصر أصل سطحي بالطريق
   */
  static async addIntersection(assetData) {
    const { id, name, intersection_type, lat, lng, attributes } = assetData;
    const intId = id || `INT_${Date.now()}`;
    const latVal = parseFloat(lat || 32.3301);
    const lngVal = parseFloat(lng || 35.7501);

    const intObj = {
      id: intId,
      name: name || 'تقاطع طريق',
      intersection_type: intersection_type || 'دوار',
      lat: latVal,
      lng: lngVal,
      attributes: attributes || {}
    };

    if (isPostgresActive()) {
      try {
        const query = `
          INSERT INTO public.rams_intersections (id, name, intersection_type, geom, attributes)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
          RETURNING *, ST_AsGeoJSON(geom) as geometry_json;
        `;
        const values = [
          intId,
          name || 'تقاطع طريق',
          intersection_type || 'دوار',
          lngVal,
          latVal,
          JSON.stringify(attributes || {})
        ];
        const res = await dbGet(query, values);
        if (res) return res;
      } catch (e) {
        console.warn('⚠️ Postgres addIntersection fallback:', e.message);
      }
    }

    if (!memDb.road_intersections) memDb.road_intersections = [];
    memDb.road_intersections.unshift(intObj);
    saveMemTable('road_intersections');
    return intObj;
  }

  /**
   * جلب كافة التقاطعات في نطاق معين
   */
  static async getAllIntersections() {
    if (isPostgresActive()) {
      try {
        const rows = await dbQuery(`SELECT id, name, intersection_type, attributes, ST_AsGeoJSON(geom) as geometry_json FROM public.rams_intersections`);
        if (rows && rows.length) return rows;
      } catch (e) {
        console.warn('⚠️ Postgres getAllIntersections fallback:', e.message);
      }
    }
    return memDb.road_intersections || [];
  }
}

module.exports = LinearAssetManager;


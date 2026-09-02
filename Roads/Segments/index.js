/**
 * Roads Segments Layer - Chainage & Road Segmentation Engine
 * بلدية كفرنجة الجديدة - الإصدار الموحد
 */
const { dbQuery, dbGet, dbRun, isPostgresActive, memDb, saveMemTable } = require('../../utils/database');

class ChainageSegmentEngine {
  /**
   * تنسيق قيم الـ Chainage إلى الصيغة القياسية (مثال: KM 1+250)
   */
  static formatChainage(meters) {
    const km = Math.floor(meters / 1000);
    const m = Math.round(meters % 1000);
    const mStr = String(m).padStart(3, '0');
    return `KM ${km}+${mStr}`;
  }

  /**
   * تقسيم الطريق إلى مقاطع متساوية الطول بـ Chainage تلقائي
   */
  static async splitRoadIntoSegments(roadId, segmentLengthMeters = 500) {
    let road = null;
    if (isPostgresActive()) {
      try {
        road = await dbGet(`
          SELECT id, COALESCE(length_km, length, "lengthKm", 1.0) as length_km, 
                 CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom) ELSE NULL END as geojson 
          FROM public.roads 
          WHERE id = $1 OR code = $1
        `, [roadId]);
      } catch (e) {
        console.warn('⚠️ Postgres splitRoadIntoSegments fallback:', e.message);
      }
    }

    if (!road) {
      road = (memDb.roads || []).find(r => String(r.id) === String(roadId) || String(r.code) === String(roadId));
    }

    if (!road) throw new Error('Road not found');

    const totalMeters = (parseFloat(road.length_km) || 1.0) * 1000;
    const segmentsCount = Math.max(1, Math.ceil(totalMeters / segmentLengthMeters));
    const createdSegments = [];

    for (let i = 0; i < segmentsCount; i++) {
      const startMeters = i * segmentLengthMeters;
      const endMeters = Math.min((i + 1) * segmentLengthMeters, totalMeters);
      const segmentCode = `SEG-${road.id}-${i + 1}`;
      const segmentId = `${road.id}_SEG_${i + 1}`;
      const lanesDetail = { count: 2, formattedStart: this.formatChainage(startMeters), formattedEnd: this.formatChainage(endMeters) };

      const segObj = {
        id: segmentId,
        road_id: road.id,
        segment_code: segmentCode,
        start_chainage: startMeters,
        end_chainage: endMeters,
        lanes_detail: lanesDetail
      };

      if (isPostgresActive()) {
        try {
          const query = `
            INSERT INTO public.rams_segments (id, road_id, segment_code, start_chainage, end_chainage, lanes_detail)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET start_chainage = EXCLUDED.start_chainage, end_chainage = EXCLUDED.end_chainage
            RETURNING *;
          `;
          const res = await dbGet(query, [segmentId, road.id, segmentCode, startMeters, endMeters, JSON.stringify(lanesDetail)]);
          if (res) segObj = res;
        } catch (e) {}
      }

      createdSegments.push(segObj);
    }

    if (!memDb.road_segments) memDb.road_segments = [];
    memDb.road_segments = memDb.road_segments.filter(s => String(s.road_id) !== String(road.id)).concat(createdSegments);
    saveMemTable('road_segments');

    return createdSegments;
  }
}

module.exports = ChainageSegmentEngine;


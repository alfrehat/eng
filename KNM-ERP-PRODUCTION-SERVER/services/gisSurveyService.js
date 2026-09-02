/**
 * GIS & Surveying Integration Engine
 * محرك تحويل واستيراد النقاط والملفات المساحية والهندسية
 * بلدية كفرنجة الجديدة - الإصدار الموحد v4.0
 */

const { getPool, isPostgresActive, dbGet, dbQuery, memDb, saveMemTable } = require('../utils/database');

class GisSurveyService {
  /**
   * إدخال نقاط مساحية بصيغ متعددة (Lat/Lng/Z أو GeoJSON أو CSV)
   */
  static async importSurveyPoints(pointsArray, uploadedBy = 'SYSTEM') {
    let insertedPoints = [];
    
    if (isPostgresActive()) {
      const pool = getPool();
      if (pool) {
        let client;
        try {
          client = await pool.connect();
          await client.query('BEGIN');

          for (const pt of pointsArray) {
            const lat = parseFloat(pt.lat || pt.latitude || pt.y);
            const lng = parseFloat(pt.lng || pt.longitude || pt.x);
            const elevation = parseFloat(pt.elevation || pt.z || 0);

            if (isNaN(lat) || isNaN(lng)) continue;

            const pointId = `SP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const query = `
              INSERT INTO public.road_survey_points (id, point_code, elevation_m, geom, raw_properties, uploaded_by)
              VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7)
              RETURNING id, point_code, ST_AsGeoJSON(geom) as geojson;
            `;

            const res = await client.query(query, [
              pointId,
              pt.code || 'PT-GENERIC',
              elevation,
              lng, lat,
              JSON.stringify(pt.properties || {}),
              uploadedBy
            ]);

            insertedPoints.push(res.rows[0]);
          }

          await client.query('COMMIT');
        } catch (dbErr) {
          if (client) await client.query('ROLLBACK');
          console.warn('⚠️ Database connection warning during survey points import, fallback to memory array:', dbErr.message);
        } finally {
          if (client) client.release();
        }
      }
    }

    if (insertedPoints.length === 0 && pointsArray.length > 0) {
      insertedPoints = pointsArray.map((pt, idx) => ({
        id: `SP-LOCAL-${Date.now()}-${idx}`,
        point_code: pt.code || `PT-${idx + 1}`,
        lat: parseFloat(pt.lat || pt.latitude || pt.y),
        lng: parseFloat(pt.lng || pt.longitude || pt.x),
        elevation: parseFloat(pt.elevation || pt.z || 0)
      }));

      if (!memDb.survey_points) memDb.survey_points = [];
      memDb.survey_points.push(...insertedPoints);
      saveMemTable('survey_points');
    }

    return { success: true, count: insertedPoints.length, data: insertedPoints };
  }
}

module.exports = GisSurveyService;


/**
 * Roads Maintenance Layer - Maintenance, Digging & Contracts Engine
 * بلدية كفرنجة الجديدة - الإصدار الموحد
 */
const { dbQuery, dbGet, dbRun, isPostgresActive, memDb, saveMemTable } = require('../../utils/database');

class MaintenanceHistoryEngine {
  /**
   * تسجيل عمل صيانة أو حفرية جديد على الطريق
   */
  static async recordMaintenanceWork(data) {
    const { id, road_id, project_id, contractor_name, cost_amount, work_type, complaint_id, photos_before, photos_after, execution_date } = data;
    const maintId = id || `MAINT_${Date.now()}`;
    const dateStr = execution_date || new Date().toISOString().split('T')[0];

    const record = {
      id: maintId,
      road_id,
      project_id: project_id || null,
      contractor_name: contractor_name || 'قسم الأشغال الذاتي',
      cost_amount: parseFloat(cost_amount) || 0,
      work_type: work_type || 'صيانة وقائية',
      complaint_id: complaint_id || null,
      photos_before: photos_before || [],
      photos_after: photos_after || [],
      execution_date: dateStr
    };

    if (isPostgresActive()) {
      try {
        const query = `
          INSERT INTO public.rams_maintenance_history 
            (id, road_id, project_id, contractor_name, cost_amount, work_type, complaint_id, photos_before, photos_after, execution_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;
        const values = [
          maintId,
          road_id,
          project_id || null,
          contractor_name || 'قسم الأشغال الذاتي',
          parseFloat(cost_amount) || 0,
          work_type || 'صيانة وقائية',
          complaint_id || null,
          JSON.stringify(photos_before || []),
          JSON.stringify(photos_after || []),
          dateStr
        ];
        const res = await dbGet(query, values);
        await dbRun(`UPDATE public.roads SET last_maintenance_date = $1 WHERE id = $2 OR code = $2`, [dateStr, road_id]);
        if (res) return res;
      } catch (e) {
        console.warn('⚠️ Postgres recordMaintenanceWork fallback:', e.message);
      }
    }

    if (!memDb.road_maintenance) memDb.road_maintenance = [];
    memDb.road_maintenance.unshift(record);
    saveMemTable('road_maintenance');
    return record;
  }

  /**
   * جلب سجلات الصيانة حسب الطريق
   */
  static async getRoadMaintenanceHistory(roadId) {
    if (isPostgresActive()) {
      try {
        const rows = await dbQuery(`SELECT * FROM public.rams_maintenance_history WHERE road_id = $1 ORDER BY execution_date DESC`, [roadId]);
        if (rows && rows.length) return rows;
      } catch (e) {
        console.warn('⚠️ Postgres getRoadMaintenanceHistory fallback:', e.message);
      }
    }
    return (memDb.road_maintenance || []).filter(m => String(m.road_id) === String(roadId));
  }
}

module.exports = MaintenanceHistoryEngine;


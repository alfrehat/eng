/**
 * services/inspectionEngineService.js
 * 🔍 محرك التفتيش والرقابة الميدانية وضبط الجودة (INSPECTION_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Quality Control & Field Compliance Edition
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
const notificationCenter = require('./notificationCenter');
const { logInfo, logWarn, logError } = require('./loggerService');

class InspectionEngineService {
  constructor() {
    this.engineId = 'INSPECTION_ENGINE';
    this.engineName = 'Enterprise Field Inspection & Quality Control Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'field_inspections',
      'defect_logging',
      'quality_compliance',
      'incident_notifications',
      'reinspection_workflow',
      'audit_trail'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء التفتيش والرقابة [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const logId = 'LOG-INSP-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'التفتيش وضبط الجودة',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('InspectionEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * استرجاع قائمة الفحوصات الميدانية مع الفلاتر
   */
  async getInspections(filters = {}) {
    const { roadId, condition, inspectorName, search, page, limit } = filters;

    if (isPostgresActive()) {
      let sql = 'SELECT * FROM road_inspections WHERE 1=1';
      const params = [];

      if (roadId) {
        params.push(roadId);
        sql += ` AND (road_id = $${params.length} OR road_id IN (SELECT id FROM roads WHERE code = $${params.length}))`;
      }
      if (condition) {
        params.push(condition.toUpperCase());
        sql += ` AND condition = $${params.length}`;
      }
      if (inspectorName) {
        params.push(`%${inspectorName.trim()}%`);
        sql += ` AND inspector_name ILIKE $${params.length}`;
      }
      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (site_location ILIKE $${params.length} OR notes ILIKE $${params.length} OR id ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC';

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        sql += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params) || [];
      return rows.map(r => this._formatInspectionOutput(r));
    } else {
      let list = (memDb.road_inspections || []).filter(r => {
        if (roadId && r.roadId !== roadId && r.road_id !== roadId) return false;
        if (condition && (r.condition || '').toUpperCase() !== condition.toUpperCase()) return false;
        if (inspectorName && !(r.inspectorName || r.inspector_name || '').toLowerCase().includes(inspectorName.toLowerCase())) return false;
        if (search) {
          const sTarget = `${r.siteLocation || r.site_location || ''} ${r.notes || ''} ${r.id || ''}`.toLowerCase();
          if (!sTarget.includes(search.toLowerCase())) return false;
        }
        return true;
      });

      list.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        list = list.slice(offset, offset + parsedLimit);
      }

      return list.map(r => this._formatInspectionOutput(r));
    }
  }

  /**
   * استرجاع تفاصيل فحص ميداني محدد
   */
  async getInspectionById(inspectionId) {
    if (!inspectionId) return null;
    let record = null;

    if (isPostgresActive()) {
      record = await dbGet('SELECT * FROM road_inspections WHERE id = $1', [inspectionId]);
    } else {
      record = (memDb.road_inspections || []).find(r => String(r.id) === String(inspectionId)) || null;
    }

    return this._formatInspectionOutput(record);
  }

  _formatInspectionOutput(row) {
    if (!row) return null;
    let defectsList = [];
    try {
      if (typeof row.defects === 'string') {
        defectsList = JSON.parse(row.defects || '[]');
      } else if (Array.isArray(row.defects)) {
        defectsList = row.defects;
      }
    } catch (e) {
      defectsList = [];
    }

    return {
      id: row.id,
      roadId: row.road_id || row.roadId || null,
      siteLocation: row.site_location || row.siteLocation || 'كفرنجة',
      inspectorName: row.inspector_name || row.inspectorName || 'مفتش الجودة',
      condition: row.condition || 'PASSED',
      severityLevel: row.severity_level || row.severityLevel || 'NORMAL',
      defects: defectsList,
      notes: row.notes || '',
      reinspectionDate: row.reinspection_date || row.reinspectionDate || null,
      isResolved: Boolean(row.is_resolved !== undefined ? row.is_resolved : row.isResolved),
      resolutionNotes: row.resolution_notes || row.resolutionNotes || '',
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt
    };
  }

  /**
   * توثيق كشف تفتيشي ميداني جديد وحفظه بدقة في كلا النمطين
   */
  async recordInspection(inspectionData, user = null) {
    const {
      roadId, road_id, siteLocation, site_location, inspectorName, inspector_name,
      condition, severityLevel, severity_level, defects, notes, reinspectionDate
    } = inspectionData;

    const id = await numberingEngine.generateNextId('road_inspections', { prefix: 'INSP' });
    const now = new Date().toISOString();
    const finalCondition = (condition || 'PASSED').toUpperCase();
    const finalSeverity = (severityLevel || severity_level || (finalCondition === 'FAILED' ? 'MAJOR' : 'NORMAL')).toUpperCase();
    const location = siteLocation || site_location || 'كفرنجة';
    const inspector = inspectorName || inspector_name || user?.fullName || 'مفتش الجودة والسلامة';
    const rId = roadId || road_id || null;

    const defectsArray = Array.isArray(defects) ? defects : [];

    const record = {
      id,
      road_id: rId,
      site_location: location,
      inspector_name: inspector,
      condition: finalCondition,
      severity_level: finalSeverity,
      defects: JSON.stringify(defectsArray),
      notes: notes || '',
      reinspection_date: reinspectionDate || null,
      is_resolved: finalCondition === 'PASSED',
      resolution_notes: '',
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO road_inspections
        (id, road_id, "roadId", site_location, inspector_name, condition, "generalCondition", severity_level, defects, notes, reinspection_date, is_resolved, resolution_notes, created_by, created_at, updated_at)
        VALUES ($1, $2, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [
        record.id, record.road_id, record.site_location, record.inspector_name,
        record.condition, record.severity_level, record.defects, record.notes,
        record.reinspection_date, record.is_resolved, record.resolution_notes,
        record.created_by
      ]);

      if (rId && (inspectionData.pciScore || inspectionData.pci_score)) {
        const pci = parseFloat(inspectionData.pciScore || inspectionData.pci_score);
        await dbRun('UPDATE roads SET pci_score = $1, last_maintenance_date = CURRENT_DATE, updated_at = NOW() WHERE id = $2', [pci, rId]);
      }
    } else {
      if (!memDb.road_inspections) memDb.road_inspections = [];
      memDb.road_inspections.unshift(record);
      saveMemTable('road_inspections');
    }

    // إطلاق الإنذار الفوري عند الفشل أو وجود عيوب خطيرة
    if (finalCondition === 'FAILED') {
      notificationCenter.sendInternalAlert(
        `🚨 فشل الفحص الميداني: تم رصد مخالفة (${finalSeverity}) في موقع [${location}] على الشارع [${rId || 'غير محدد'}]`,
        {
          roadId: rId,
          issue: notes || 'فشل الفحص الميداني وضبط الجودة',
          inspector,
          severity: finalSeverity
        }
      );
    }

    await this._recordAudit(user?.id, id, 'INSPECTION_RECORDED', null, record);
    return this._formatInspectionOutput(record);
  }

  /**
   * توثيق إعادة التفتيش وتصويب العيوب المرصودة
   */
  async resolveInspection(inspectionId, resolutionData, user = null) {
    const existing = await this.getInspectionById(inspectionId);
    if (!existing) throw new Error(`تقرير التفتيش [${inspectionId}] غير موجود.`);

    const { resolutionNotes, newCondition = 'PASSED' } = resolutionData;
    const now = new Date().toISOString();

    const updates = {
      condition: newCondition.toUpperCase(),
      is_resolved: true,
      resolution_notes: resolutionNotes || 'تم تصويب الخلل وإعادة الفحص بنجاح',
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE road_inspections
        SET condition = $1, "generalCondition" = $1, is_resolved = $2, resolution_notes = $3, updated_at = NOW()
        WHERE id = $4
      `, [updates.condition, updates.is_resolved, updates.resolution_notes, existing.id]);
    } else {
      const idx = (memDb.road_inspections || []).findIndex(r => String(r.id) === String(existing.id));
      if (idx !== -1) {
        memDb.road_inspections[idx] = { ...memDb.road_inspections[idx], ...updates };
        saveMemTable('road_inspections');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'INSPECTION_RESOLVED', existing, updates);
    return await this.getInspectionById(existing.id);
  }

  /**
   * حذف تقرير تفتيش ميداني
   */
  async deleteInspection(inspectionId, user = null) {
    const existing = await this.getInspectionById(inspectionId);
    if (!existing) throw new Error(`تقرير التفتيش [${inspectionId}] غير موجود.`);

    if (isPostgresActive()) {
      await dbRun('DELETE FROM road_inspections WHERE id = $1', [inspectionId]);
    } else {
      memDb.road_inspections = (memDb.road_inspections || []).filter(r => String(r.id) !== String(inspectionId));
      saveMemTable('road_inspections');
    }

    await this._recordAudit(user?.id, inspectionId, 'INSPECTION_DELETED', existing, null);
    return { success: true, message: `تم حذف تقرير التفتيش [${inspectionId}] بنجاح.` };
  }

  /**
   * استرجاع إحصائيات التفتيش الميداني ونسب الامتثال الفني
   */
  async getInspectionStats() {
    const all = await this.getInspections({});
    let passedCount = 0;
    let failedCount = 0;
    let pendingReinspection = 0;

    all.forEach(i => {
      if (i.condition === 'PASSED') passedCount++;
      else failedCount++;

      if (!i.isResolved && i.reinspectionDate) pendingReinspection++;
    });

    const total = all.length;
    const complianceRate = total > 0 ? Math.round((passedCount / total) * 100) : 100;

    return {
      totalInspections: total,
      passedCount,
      failedCount,
      pendingReinspection,
      complianceRate
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalInspections = 0;
    let failedCount = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE condition = 'FAILED') as failed FROM road_inspections");
        totalInspections = parseInt(res?.total || 0, 10);
        failedCount = parseInt(res?.failed || 0, 10);
      } else {
        const list = memDb.road_inspections || [];
        totalInspections = list.length;
        failedCount = list.filter(r => (r.condition || '').toUpperCase() === 'FAILED').length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalInspections,
        failedInspections: failedCount,
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

const inspectionEngineService = new InspectionEngineService();
module.exports = inspectionEngineService;

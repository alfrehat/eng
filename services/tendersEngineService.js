/**
 * services/tendersEngineService.js
 * 📑 محرك إدارة العطاءات والمشتريات الهندسية (TENDERS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v2.0 - Anti-Gravity Enterprise Patch
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

class TendersEngineService {
  constructor() {
    this.engineId = 'TENDERS_ENGINE';
    this.engineName = 'Enterprise Tenders & Procurement Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'tender_crud',
      'boq_management',
      'daily_reports',
      'financial_tracking',
      'tender_awarding',
      'budget_synchronization'
    ];

    // خريطة تحويل المفاتيح لمنع أخطاء تسميات الأعمدة في PostgreSQL
    this.columnMap = {
      open_date: 'openDate',
      close_date: 'closeDate',
      attachment_path: 'attachmentPath',
      tender_type: 'tenderType',
      purchase_method: 'purchaseMethod',
      purchase_committee: 'purchaseCommittee',
      estimated_value: 'estimatedValue',
      awarded_value: 'awardedValue',
      commencement_date: 'commencementDate',
      duration_days: 'durationDays',
      supervisor_engineer: 'supervisorEngineer',
      completion_percentage: 'completionPercentage',
      variation_orders_value: 'variationOrdersValue',
      tender_number: 'tenderNumber',
      boq_items_json: 'boqItemsJson',
      contract_sign_date: 'contractSignDate',
      preliminary_handover_date: 'preliminaryHandoverDate',
      final_handover_date: 'finalHandoverDate',
      performance_bond_number: 'performanceBondNumber',
      performance_bond_value: 'performanceBondValue',
      performance_bond_expiry: 'performanceBondExpiry',
      budget_line_id: 'budget_line_id',
      project_id: 'project_id'
    };
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء العطاءات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'العطاءات والمناقصات',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('TendersEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * تفكيك وتطبيع بنية بيانات العطاء المرتجعة للواجهات
   */
  _formatTenderOutput(row) {
    if (!row) return null;
    let boq = [];
    try {
      if (typeof row.boqItemsJson === 'string') {
        boq = JSON.parse(row.boqItemsJson || '[]');
      } else if (Array.isArray(row.boqItemsJson)) {
        boq = row.boqItemsJson;
      }
    } catch (e) {
      boq = [];
    }

    return {
      ...row,
      tenderNumber: row.tenderNumber || row.tender_number || row.id,
      projectId: row.project_id || row.projectId || null,
      budgetLineId: row.budget_line_id || row.budgetLineId || null,
      boqItems: boq,
      value: parseFloat(row.value || 0),
      estimatedValue: parseFloat(row.estimatedValue || row.estimated_value || 0),
      awardedValue: parseFloat(row.awardedValue || row.awarded_value || 0)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة العطاءات (Tenders CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة العطاءات مع البحث والتصفح الآمن
   */
  async getTenders(filters = {}) {
    const { search, status, tenderType, purchaseMethod, purchaseCommittee, projectId, page, limit } = filters;
    
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM tenders WHERE 1=1';
      const params = [];

      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (name ILIKE $${params.length} OR contractor ILIKE $${params.length} OR id ILIKE $${params.length} OR "tenderNumber" ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (tenderType) {
        params.push(tenderType);
        sql += ` AND "tenderType" = $${params.length}`;
      }
      if (purchaseMethod) {
        params.push(purchaseMethod);
        sql += ` AND "purchaseMethod" = $${params.length}`;
      }
      if (purchaseCommittee) {
        params.push(purchaseCommittee);
        sql += ` AND "purchaseCommittee" = $${params.length}`;
      }
      if (projectId) {
        params.push(projectId);
        sql += ` AND (project_id = $${params.length} OR "projectId" = $${params.length})`;
      }

      sql += ' ORDER BY "createdAt" DESC';

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        sql += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params) || [];
      return rows.map(r => this._formatTenderOutput(r));
    } else {
      let rows = (memDb.tenders || []).filter(r => {
        const sTarget = `${r.name || ''} ${r.contractor || ''} ${r.id || ''} ${r.tenderNumber || ''}`.toLowerCase();
        if (search && !sTarget.includes(search.toLowerCase())) return false;
        if (status && r.status !== status) return false;
        if (tenderType && r.tenderType !== tenderType) return false;
        if (purchaseMethod && r.purchaseMethod !== purchaseMethod) return false;
        if (purchaseCommittee && r.purchaseCommittee !== purchaseCommittee) return false;
        if (projectId && (r.project_id !== projectId && r.projectId !== projectId)) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        rows = rows.slice(offset, offset + parsedLimit);
      }
      return rows.map(r => this._formatTenderOutput(r));
    }
  }

  /**
   * استرجاع تفاصيل عطاء محدد بالمعرف أو الرقم المرجعي
   */
  async getTenderById(tenderId) {
    if (!tenderId) return null;
    let tender = null;

    if (isPostgresActive()) {
      tender = await dbGet('SELECT * FROM tenders WHERE id = $1 OR "tenderNumber" = $1', [tenderId]);
    } else {
      tender = (memDb.tenders || []).find(r => String(r.id) === String(tenderId) || String(r.tenderNumber) === String(tenderId)) || null;
    }

    return this._formatTenderOutput(tender);
  }

  /**
   * إنشاء عطاء جديد مع حجز المخصص المالي والترقيم الذري الموحد
   */
  async createTender(tenderData, user = null) {
    const {
      name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
      commencementDate, durationDays, supervisorEngineer, completionPercentage,
      variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
      preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
      performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
      tenderType, purchaseMethod, purchaseCommittee, attachmentPath, projectId, project_id,
      budget_line_id, budgetLineId
    } = tenderData;

    if (!name) throw new Error('اسم العطاء/المشروع مطلوب.');

    // 1. الترقيم المؤسسي الموحد من NumberingEngine
    const id = await numberingEngine.generateNextId('tenders');
    const finalTenderNumber = tenderNumber || id;
    const now = new Date().toISOString();

    const finalVal = parseFloat(awardedValue) || parseFloat(value) || parseFloat(estimatedValue) || 0;
    const estVal = parseFloat(estimatedValue) || parseFloat(value) || 0;
    const awdVal = parseFloat(awardedValue) || finalVal;
    const selectedBudgetLineId = budget_line_id || budgetLineId || null;
    const linkedProjectId = projectId || project_id || null;

    // 2. حجز المخصص المالي في محرك الموازنة
    if (selectedBudgetLineId && finalVal > 0) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.createAllocation === 'function') {
          await budgetEngineService.createAllocation({
            budget_line_id: selectedBudgetLineId,
            entity_type: 'TENDER',
            entity_id: id,
            entity_name: name,
            amount: finalVal,
            status: 'COMMITTED'
          });
        }
      } catch (be) {
        logWarn('TendersEngine', `Budget allocation error: ${be.message}`);
        throw new Error(`تعذر اعتماد العطاء لعدم توفر مخصص مالي كافٍ: ${be.message}`);
      }
    }

    const record = {
      id,
      name,
      contractor: contractor || '',
      openDate: openDate || '',
      closeDate: closeDate || '',
      value: finalVal,
      status: status || 'مفتوح',
      notes: notes || '',
      lat: parseFloat(lat) || 32.3301,
      lng: parseFloat(lng) || 35.7501,
      attachmentPath: attachmentPath || '',
      tenderType: tenderType || 'أشغال',
      purchaseMethod: purchaseMethod || 'مناقصة عامة',
      purchaseCommittee: purchaseCommittee || 'لجنة الشراء المحلية',
      estimatedValue: estVal,
      awardedValue: awdVal,
      commencementDate: commencementDate || '',
      durationDays: parseInt(durationDays, 10) || 0,
      supervisorEngineer: supervisorEngineer || '',
      completionPercentage: parseFloat(completionPercentage) || 0,
      variationOrdersValue: parseFloat(variationOrdersValue) || 0,
      district: district || 'كفرنجة',
      tenderNumber: finalTenderNumber,
      boqItemsJson: typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
      contractSignDate: contractSignDate || '',
      preliminaryHandoverDate: preliminaryHandoverDate || '',
      finalHandoverDate: finalHandoverDate || '',
      performanceBondNumber: performanceBondNumber || '',
      performanceBondValue: parseFloat(performanceBondValue) || 0,
      performanceBondExpiry: performanceBondExpiry || '',
      project_id: linkedProjectId,
      budget_line_id: selectedBudgetLineId,
      createdAt: now,
      updatedAt: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO tenders (
          id, name, contractor, "openDate", "closeDate", value, status, notes, lat, lng,
          "attachmentPath", "tenderType", "purchaseMethod", "purchaseCommittee",
          "estimatedValue", "awardedValue", "commencementDate", "durationDays",
          "supervisorEngineer", "completionPercentage", "variationOrdersValue",
          "district", "tenderNumber", "boqItemsJson", "contractSignDate",
          "preliminaryHandoverDate", "finalHandoverDate", "performanceBondNumber",
          "performanceBondValue", "performanceBondExpiry", project_id, budget_line_id, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32, NOW(), NOW()
        )
      `, [
        record.id, record.name, record.contractor, record.openDate, record.closeDate, record.value,
        record.status, record.notes, record.lat, record.lng, record.attachmentPath, record.tenderType,
        record.purchaseMethod, record.purchaseCommittee, record.estimatedValue, record.awardedValue,
        record.commencementDate, record.durationDays, record.supervisorEngineer, record.completionPercentage,
        record.variationOrdersValue, record.district, record.tenderNumber, record.boqItemsJson,
        record.contractSignDate, record.preliminaryHandoverDate, record.finalHandoverDate,
        record.performanceBondNumber, record.performanceBondValue, record.performanceBondExpiry,
        record.project_id, record.budget_line_id
      ]);
    } else {
      if (!memDb.tenders) memDb.tenders = [];
      memDb.tenders.unshift(record);
      saveMemTable('tenders');
    }

    await this._recordAudit(user?.id, id, 'TENDER_CREATED', null, record);
    return this._formatTenderOutput(record);
  }

  /**
   * تعديل بيانات عطاء مع تطبيع أسماء الأعمدة وحمايتها
   */
  async updateTender(tenderId, updates, user = null) {
    const existing = await this.getTenderById(tenderId);
    if (!existing) throw new Error(`العطاء [${tenderId}] غير موجود.`);

    const actualId = existing.id;
    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updatedAt: now };

    if (isPostgresActive()) {
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        const setClauses = [];
        const params = [actualId];

        keys.forEach(k => {
          // استخدام الاسم المطابق للعمود في قاعدة البيانات
          const colName = this.columnMap[k] || k;
          params.push(updates[k]);
          setClauses.push(`"${colName}" = $${params.length}`);
        });

        await dbRun(`UPDATE tenders SET ${setClauses.join(', ')}, "updatedAt" = NOW() WHERE id = $1`, params);
      }
    } else {
      const idx = (memDb.tenders || []).findIndex(r => String(r.id) === String(actualId));
      if (idx !== -1) {
        memDb.tenders[idx] = { ...memDb.tenders[idx], ...updated };
        saveMemTable('tenders');
      }
    }

    await this._recordAudit(user?.id, actualId, 'TENDER_UPDATED', existing, updated);
    return await this.getTenderById(actualId);
  }

  /**
   * حذف عطاء وتحرير الحجز المالي المرتبط به في الموازنة
   */
  async deleteTender(tenderId, user = null) {
    const existing = await this.getTenderById(tenderId);
    if (!existing) throw new Error(`العطاء [${tenderId}] غير موجود.`);

    const actualId = existing.id;

    // تحرير مخصص الموازنة الملغى
    if (existing.budgetLineId) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.releaseAllocation === 'function') {
          await budgetEngineService.releaseAllocation({
            entity_type: 'TENDER',
            entity_id: actualId
          });
        }
      } catch (e) {
        logWarn('TendersEngine', `Failed to release budget allocation on delete: ${e.message}`);
      }
    }

    if (isPostgresActive()) {
      await dbRun('DELETE FROM tenders WHERE id = $1', [actualId]);
    } else {
      memDb.tenders = (memDb.tenders || []).filter(r => String(r.id) !== String(actualId));
      saveMemTable('tenders');
    }

    await this._recordAudit(user?.id, actualId, 'TENDER_DELETED', existing, null);
    return { success: true, message: 'تم حذف العطاء وتحرير مخصصاته المالية بنجاح.' };
  }

  /**
   * إحالة العطاء ومزامنة القيمة المالية النهائية في الموازنة
   */
  async awardTender(tenderId, awardData, user = null) {
    const existing = await this.getTenderById(tenderId);
    if (!existing) throw new Error(`العطاء [${tenderId}] غير موجود.`);

    const { contractor, awardedValue, contractSignDate, commencementDate, durationDays } = awardData;
    if (!contractor || awardedValue === undefined) {
      throw new Error('اسم المقاول وقيمة الإحالة مطلوبان.');
    }

    const finalAwardedVal = parseFloat(awardedValue);

    // مزامنة القيمة المحجوزة في الموازنة عند تغير قيمة الإحالة عن التقديرية
    if (existing.budgetLineId && finalAwardedVal !== existing.value) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.updateAllocationAmount === 'function') {
          await budgetEngineService.updateAllocationAmount({
            entity_type: 'TENDER',
            entity_id: existing.id,
            new_amount: finalAwardedVal
          });
        }
      } catch (be) {
        logWarn('TendersEngine', `Budget reallocation error on award: ${be.message}`);
      }
    }

    return await this.updateTender(existing.id, {
      contractor,
      awardedValue: finalAwardedVal,
      value: finalAwardedVal,
      status: 'محال',
      contractSignDate: contractSignDate || '',
      commencementDate: commencementDate || '',
      durationDays: parseInt(durationDays, 10) || 0
    }, user);
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalTenders = 0;
    let awardedTenders = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'محال') as awarded FROM tenders");
        totalTenders = parseInt(res?.total || 0, 10);
        awardedTenders = parseInt(res?.awarded || 0, 10);
      } else {
        const all = memDb.tenders || [];
        totalTenders = all.length;
        awardedTenders = all.filter(t => t.status === 'محال').length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalTenders,
        awardedTenders,
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

module.exports = new TendersEngineService();

/**
 * services/tendersEngineService.js
 * 📑 محرك إدارة العطاءات والمشتريات الهندسية (TENDERS_ENGINE — Phase 05-A)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة دورة حياة العطاءات والمناقصات البلدية والربط بالمشاريع الرأسمالية.
 * 2. إدارة جداول الكميات والأسعار الفنية (BOQ Management).
 * 3. المتابعة الميدانية والتقارير اليومية للمهندسين المشرفين (Daily Reports).
 * 4. إجراءات الإحالة وتوقيع العقود والكفالات الأولية (Awarding & Performance Bonds).
 * 5. التكامل مع سجل التدقيق والمحركات المؤسسية عبر EngineOrchestrator.
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable,
  generateSequenceId
} = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

class TendersEngineService {
  constructor() {
    this.engineId = 'TENDERS_ENGINE';
    this.engineName = 'Enterprise Tenders & Procurement Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'tender_crud',
      'boq_management',
      'daily_reports',
      'financial_tracking',
      'tender_awarding'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء العطاءات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'العطاءات والمشاريع الرأسمالية', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-TND-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'العطاءات والمشاريع الرأسمالية',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('TendersEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة العطاءات (Tenders CRUD & Query Operations)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة العطاءات مع الفلاتر والبحث
   */
  async getTenders(filters = {}) {
    const { search, status, tenderType, purchaseMethod, purchaseCommittee, page, limit } = filters;
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM tenders WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
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
      sql += ' ORDER BY "createdAt" DESC';

      if (page && limit) {
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`;
      }

      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.tenders || []).filter(r => {
        if (search && !(`${r.name} ${r.contractor} ${r.id} ${r.tenderNumber || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (status && r.status !== status) return false;
        if (tenderType && r.tenderType !== tenderType) return false;
        if (purchaseMethod && r.purchaseMethod !== purchaseMethod) return false;
        if (purchaseCommittee && r.purchaseCommittee !== purchaseCommittee) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      if (page && limit) {
        const p = parseInt(page, 10);
        const l = parseInt(limit, 10);
        rows = rows.slice((p - 1) * l, p * l);
      }
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل عطاء محدد
   */
  async getTenderById(tenderId) {
    if (!tenderId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM tenders WHERE id = $1', [tenderId]);
    } else {
      return (memDb.tenders || []).find(r => String(r.id) === String(tenderId)) || null;
    }
  }

  /**
   * إنشاء عطاء جديد
   */
  async createTender(tenderData, user = null) {
    const {
      name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
      commencementDate, durationDays, supervisorEngineer, completionPercentage,
      variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
      preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
      performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
      tenderType, purchaseMethod, purchaseCommittee, attachmentPath, projectId
    } = tenderData;

    if (!name) throw new Error('اسم العطاء/المشروع مطلوب.');

    const id = await generateSequenceId('T', 'tenders');
    const now = new Date().toISOString();
    const finalVal = parseFloat(awardedValue) || parseFloat(value) || parseFloat(estimatedValue) || 0;
    const estVal = parseFloat(estimatedValue) || parseFloat(value) || 0;
    const awdVal = parseFloat(awardedValue) || finalVal;

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
      tenderNumber: tenderNumber || id,
      boqItemsJson: typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
      contractSignDate: contractSignDate || '',
      preliminaryHandoverDate: preliminaryHandoverDate || '',
      finalHandoverDate: finalHandoverDate || '',
      performanceBondNumber: performanceBondNumber || '',
      performanceBondValue: parseFloat(performanceBondValue) || 0,
      performanceBondExpiry: performanceBondExpiry || '',
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
          "performanceBondValue", "performanceBondExpiry", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, NOW(), NOW()
        )
      `, Object.values(record).slice(0, 30));
    } else {
      if (!memDb.tenders) memDb.tenders = [];
      memDb.tenders.unshift(record);
      saveMemTable('tenders');
    }

    await this._recordAudit(user?.id, id, 'TENDER_CREATED', null, record);
    return record;
  }

  /**
   * تعديل بيانات عطاء
   */
  async updateTender(tenderId, updates, user = null) {
    const existing = await this.getTenderById(tenderId);
    if (!existing) throw new Error(`العطاء [${tenderId}] غير موجود.`);

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updatedAt: now };

    if (isPostgresActive()) {
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        let setClauses = [];
        const params = [tenderId];
        keys.forEach((k, idx) => {
          setClauses.push(`"${k}" = $${idx + 2}`);
          params.push(updates[k]);
        });
        await dbRun(`UPDATE tenders SET ${setClauses.join(', ')}, "updatedAt" = NOW() WHERE id = $1`, params);
      }
    } else {
      const idx = (memDb.tenders || []).findIndex(r => String(r.id) === String(tenderId));
      if (idx !== -1) {
        memDb.tenders[idx] = updated;
        saveMemTable('tenders');
      }
    }

    await this._recordAudit(user?.id, tenderId, 'TENDER_UPDATED', existing, updated);
    return updated;
  }

  /**
   * حذف عطاء
   */
  async deleteTender(tenderId, user = null) {
    const existing = await this.getTenderById(tenderId);
    if (!existing) throw new Error(`العطاء [${tenderId}] غير موجود.`);

    if (isPostgresActive()) {
      await dbRun('DELETE FROM tenders WHERE id = $1', [tenderId]);
    } else {
      memDb.tenders = (memDb.tenders || []).filter(r => String(r.id) !== String(tenderId));
      saveMemTable('tenders');
    }

    await this._recordAudit(user?.id, tenderId, 'TENDER_DELETED', existing, null);
    return { success: true, message: 'تم حذف العطاء بنجاح.' };
  }

  /**
   * إحالة العطاء وترسيته على المقاول (Tender Awarding)
   */
  async awardTender(tenderId, awardData, user = null) {
    const { contractor, awardedValue, contractSignDate, commencementDate, durationDays } = awardData;
    if (!contractor || !awardedValue) throw new Error('اسم المقاول وقيمة الإحالة مطلوبان.');

    return await this.updateTender(tenderId, {
      contractor,
      awardedValue: parseFloat(awardedValue),
      value: parseFloat(awardedValue),
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

const tendersEngineService = new TendersEngineService();
module.exports = tendersEngineService;

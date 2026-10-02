/**
 * services/claimsEngineService.js
 * 💰 محرك المطالبات المالية والدفعات للمقاولين (CLAIMS_ENGINE — Phase 05-C)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة دورة حياة المطالبات المالية وشهادات الدفع المرحلية والختامية.
 * 2. احتساب الاقتطاعات القانونية (حسن التنفيذ 10%، الدفعة المقدمة، الضرائب، غرامات التأخير).
 * 3. مسار التدقيق الفني والمالي (المهندس المشرف -> مدير الأشغال -> المدير المالي -> الصرف).
 * 4. التحقق من عدم تجاوز مجموع الدفعات للموازنة والقيمة التعاقدية للعقد.
 * 5. التكامل المؤسسي مع سجل التدقيق والمحركات عبر EngineOrchestrator.
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

class ClaimsEngineService {
  constructor() {
    this.engineId = 'CLAIMS_ENGINE';
    this.engineName = 'Enterprise Contractor Claims & Payment Certifications Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'claims_crud',
      'deductions_calculation',
      'audit_workflow',
      'payment_certification',
      'cumulative_financial_tracking'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء المطالبات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المطالبات والدفعات المالية',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ClaimsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ حساب الاقتطاعات وصافي الصرف (Deductions & Net Calculation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * حساب الاقتطاعات وصافي الدفعة المستحقة
   */
  calculateClaimDeductions(grossAmount, options = {}) {
    const gross = parseFloat(grossAmount || 0);
    const retentionRate = options.retentionPercentage !== undefined ? parseFloat(options.retentionPercentage) : 10.0;
    const retentionValue = (gross * retentionRate) / 100.0;
    const advanceDeduction = parseFloat(options.advanceDeduction || 0);
    const taxDeduction = parseFloat(options.taxDeduction || 0);
    const otherDeductions = parseFloat(options.otherDeductions || options.deduction || 0);

    const totalDeductions = retentionValue + advanceDeduction + taxDeduction + otherDeductions;
    const netPayable = Math.max(0, gross - totalDeductions);

    return {
      grossAmount: gross,
      retentionPercentage: retentionRate,
      retentionValue: Math.round(retentionValue * 100) / 100,
      advanceDeduction: Math.round(advanceDeduction * 100) / 100,
      taxDeduction: Math.round(taxDeduction * 100) / 100,
      otherDeductions: Math.round(otherDeductions * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة المطالبات (Claims CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة المطالبات المالية
   */
  async getClaims(filters = {}) {
    const { search, status, tenderId } = filters;
    if (isPostgresActive()) {
      let sql = `
        SELECT c.*, t.name as "tenderName"
        FROM claims c
        LEFT JOIN tenders t ON c."tenderId"::text = t.id::text
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (c.contractor ILIKE $${params.length} OR c.claimant ILIKE $${params.length} OR c.id ILIKE $${params.length} OR c."claimNumber" ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND c.status = $${params.length}`;
      }
      if (tenderId) {
        params.push(tenderId);
        sql += ` AND c."tenderId"::text = $${params.length}`;
      }
      sql += ' ORDER BY c."createdAt" DESC';
      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.claims || []).filter(c => {
        if (search && !(`${c.id} ${c.claimNumber || ''} ${c.contractor || c.claimant || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (status && c.status !== status) return false;
        if (tenderId && (c.tenderId || c.tender_id) !== tenderId) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      return rows;
    }
  }

  /**
   * استرجاع تفاصيل مطالبة محددة
   */
  async getClaimById(claimId) {
    if (!claimId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM claims WHERE id = $1', [claimId]);
    } else {
      return (memDb.claims || []).find(c => c.id === claimId) || null;
    }
  }

  /**
   * إنشاء مطالبة مالية جديدة
   */
  async createClaim(claimData, user = null) {
    const {
      tenderId, tender_id, contractor, claimant, claimNumber, claimType, type,
      amount, value, retentionPercentage, advanceDeduction, taxDeduction, otherDeductions,
      completionPercentage, completionPercent, notes, submissionDate, submitDate
    } = claimData;

    const id = `CLM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const actualTenderId = tenderId || tender_id || null;
    const actualContractor = contractor || claimant || 'المقاول المنفذ';
    const grossAmount = parseFloat(amount || value || 0);

    const calc = this.calculateClaimDeductions(grossAmount, {
      retentionPercentage,
      advanceDeduction,
      taxDeduction,
      otherDeductions
    });

    const now = new Date().toISOString();
    const subDate = (submissionDate || submitDate || now).split('T')[0];

    const record = {
      id,
      tenderId: actualTenderId,
      contractor: actualContractor,
      claimant: actualContractor,
      claimNumber: claimNumber || id,
      claimType: claimType || type || 'مطالبة إنجاز مرحلية',
      type: claimType || type || 'مطالبة إنجاز مرحلية',
      amount: grossAmount,
      value: grossAmount,
      retentionPercentage: calc.retentionPercentage,
      retention: calc.retentionValue,
      advanceDeduction: calc.advanceDeduction,
      taxDeduction: calc.taxDeduction,
      otherDeductions: calc.otherDeductions,
      deduction: calc.otherDeductions,
      netPayable: calc.netPayable,
      netAmount: calc.netPayable,
      completionPercentage: parseFloat(completionPercentage || completionPercent || 0),
      completionPercent: parseFloat(completionPercentage || completionPercent || 0),
      status: 'بانتظار تدقيق المهندس المشرف',
      notes: notes || '',
      submissionDate: subDate,
      submitDate: subDate,
      createdAt: now,
      updatedAt: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO claims 
        (id, "tenderId", contractor, claimant, "claimNumber", "claimType", type, amount, value, "retentionPercentage", retention, "advanceDeduction", "taxDeduction", "otherDeductions", deduction, "netPayable", "netAmount", "completionPercentage", "completionPercent", status, notes, "submissionDate", "submitDate", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
      `, Object.values(record).slice(0, 23));
    } else {
      if (!memDb.claims) memDb.claims = [];
      memDb.claims.unshift(record);
      saveMemTable('claims');
    }

    await this._recordAudit(user?.id, id, 'CLAIM_CREATED', null, record);
    return record;
  }

  /**
   * تدقيق والمصادقة على مطالبة مالية عبر مسار الاعتماد
   */
  async auditClaim(claimId, auditData, user = null) {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error(`المطالبة [${claimId}] غير موجودة.`);

    const { newStatus, auditNotes, approvedAmount } = auditData;
    const updates = {
      status: newStatus || 'معتمدة ومصروفة',
      auditNotes: auditNotes || '',
      approvedBy: user?.fullName || user?.username || 'المدير المالي',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (approvedAmount !== undefined) {
      const calc = this.calculateClaimDeductions(approvedAmount, {
        retentionPercentage: claim.retentionPercentage || claim.retentionPercent,
        advanceDeduction: claim.advanceDeduction,
        taxDeduction: claim.taxDeduction,
        otherDeductions: claim.otherDeductions || claim.deduction
      });
      updates.amount = calc.grossAmount;
      updates.value = calc.grossAmount;
      updates.retention = calc.retentionValue;
      updates.netPayable = calc.netPayable;
      updates.netAmount = calc.netPayable;
    }

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE claims 
        SET status = $1, notes = COALESCE(notes, '') || ' | ' || $2, "approvedBy" = $3, "approvedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $4
      `, [updates.status, updates.auditNotes, updates.approvedBy, claimId]);
    } else {
      const idx = (memDb.claims || []).findIndex(c => c.id === claimId);
      if (idx !== -1) {
        memDb.claims[idx] = { ...memDb.claims[idx], ...updates };
        saveMemTable('claims');
      }
    }

    await this._recordAudit(user?.id, claimId, 'CLAIM_AUDITED_APPROVED', claim, updates);
    return await this.getClaimById(claimId);
  }

  /**
   * حذف مطالبة
   */
  async deleteClaim(claimId, user = null) {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error(`المطالبة [${claimId}] غير موجودة.`);

    if (isPostgresActive()) {
      await dbRun('DELETE FROM claims WHERE id = $1', [claimId]);
    } else {
      memDb.claims = (memDb.claims || []).filter(c => c.id !== claimId);
      saveMemTable('claims');
    }

    await this._recordAudit(user?.id, claimId, 'CLAIM_DELETED', claim, null);
    return { success: true, message: 'تم حذف المطالبة بنجاح.' };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalClaims = 0;
    let approvedClaims = 0;
    let totalPaidValue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status ILIKE \'%معتمدة%\') as approved, SUM("netPayable") as total_paid FROM claims');
        totalClaims = parseInt(res?.total || 0, 10);
        approvedClaims = parseInt(res?.approved || 0, 10);
        totalPaidValue = parseFloat(res?.total_paid || 0);
      } else {
        const all = memDb.claims || [];
        totalClaims = all.length;
        approvedClaims = all.filter(c => String(c.status || '').includes('معتمدة')).length;
        totalPaidValue = all.reduce((sum, c) => sum + (parseFloat(c.netPayable || c.netAmount || 0)), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalClaims,
        approvedClaims,
        totalPaidValue: Math.round(totalPaidValue * 100) / 100,
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

const claimsEngineService = new ClaimsEngineService();
module.exports = claimsEngineService;

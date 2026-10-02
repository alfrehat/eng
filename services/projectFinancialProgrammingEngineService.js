/**
 * services/projectFinancialProgrammingEngineService.js
 * 💵 محرك البرمجة والتخصيص المالي السنوي ومتعدد السنوات للمشاريع (PROJECT_FINANCIAL_PROGRAMMING_ENGINE)
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
const projectsEngineService = require('./projectsEngineService');
const projectPortfolioEngineService = require('./projectPortfolioEngineService');
const { logInfo, logWarn, logError } = require('./loggerService');

class ProjectFinancialProgrammingEngineService {
  constructor() {
    this.engineId = 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE';
    this.engineName = 'Enterprise Project Financial Programming Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'annual_programming',
      'multi_year_allocation',
      'budget_ceiling_validation',
      'plan_financial_aggregation'
    ];
  }

  /**
   * تقريب مالي آمن لمنع أخطاء الفاصلة العائمة
   */
  _roundCurrency(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء البرمجة المالية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'البرمجة المالية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ProjectFinancialProgrammingEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * إنشاء مخصص برمجة مالية سنوية لمشروع ضمن خطة
   */
  async createFinancialProgram(data, user = null) {
    const rawPlanId = data.planId || data.plan_id;
    const rawProjectId = data.projectId || data.project_id;
    const fiscalYear = parseInt(data.fiscalYear || data.fiscal_year || new Date().getFullYear(), 10);
    const programmedAmount = this._roundCurrency(data.programmedAmount || data.programmed_amount || 0);

    if (!rawPlanId) throw new Error('معرف الخطة (planId) حقل إلزامي.');
    if (!rawProjectId) throw new Error('معرف المشروع (projectId) حقل إلزامي.');
    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new Error('السنة المالية (fiscalYear) غير صالحة.');
    }
    if (programmedAmount <= 0) {
      throw new Error('المبلغ المبرمج (programmedAmount) يجب أن يكون أكبر من الصفر.');
    }

    // 1. التحقق من وجود المشروع وحل المعرف الفعلي
    const project = await projectsEngineService.getProjectById(rawProjectId);
    if (!project) {
      throw new Error(`المشروع الهندسي [${rawProjectId}] غير موجود.`);
    }

    // 2. التحقق من وجود الخطة وحل المعرف الفعلي
    const plan = await projectPortfolioEngineService.getPlanById(rawPlanId);
    if (!plan) {
      throw new Error(`الخطة الهندسية [${rawPlanId}] غير موجودة.`);
    }

    const actualProjectId = project.id;
    const actualPlanId = plan.id;

    // 3. فحص منع تكرار نفس السنة للمشروع في نفس الخطة (مع استبعاد الملغاة)
    let duplicate = null;
    if (isPostgresActive()) {
      duplicate = await dbGet(
        "SELECT id FROM public.project_financial_programs WHERE plan_id = $1 AND project_id = $2 AND fiscal_year = $3 AND status != 'CANCELLED'",
        [actualPlanId, actualProjectId, fiscalYear]
      );
    } else {
      duplicate = (memDb.project_financial_programs || []).find(p => 
        (p.plan_id === actualPlanId || p.planId === actualPlanId) && 
        (p.project_id === actualProjectId || p.projectId === actualProjectId) && 
        parseInt(p.fiscal_year || p.fiscalYear, 10) === fiscalYear &&
        p.status !== 'CANCELLED'
      );
    }
    if (duplicate) {
      throw new Error(`توجد مخصصات مبرمجة نشطة لهذا المشروع للسنة المالية [${fiscalYear}] في الخطة [${plan.plan_number || actualPlanId}].`);
    }

    // 4. فحص سقف الموازنة المعتمدة بدقة محاسبية
    const approvedBudget = this._roundCurrency(project.approved_budget || project.approvedBudget || project.budget_amount || project.budgetAmount || 0);
    const existingProgrammedTotal = await this._getProjectOtherProgrammedSum(actualProjectId, null);
    const projectedTotal = this._roundCurrency(existingProgrammedTotal + programmedAmount);

    if (approvedBudget > 0 && projectedTotal > approvedBudget) {
      const remainingAllowed = Math.max(0, this._roundCurrency(approvedBudget - existingProgrammedTotal));
      throw new Error(`تجاوز سقف الموازنة المعتمدة للمشروع (${approvedBudget.toLocaleString('ar-JO')} د.أ). المتاح للبرمجة حالياً: ${remainingAllowed.toLocaleString('ar-JO')} د.أ.`);
    }

    const programId = data.id || `FPG-${fiscalYear}-${Date.now().toString(36)}`;
    const record = {
      id: programId,
      plan_id: actualPlanId,
      project_id: actualProjectId,
      fiscal_year: fiscalYear,
      programmed_amount: programmedAmount,
      funding_source: data.fundingSource || data.funding_source || 'MUNICIPAL_BUDGET',
      notes: data.notes || '',
      status: data.status || 'DRAFT',
      created_by: user?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_financial_programs
        (id, plan_id, project_id, fiscal_year, programmed_amount, funding_source, notes, status, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, Object.values(record));
    } else {
      if (!memDb.project_financial_programs) memDb.project_financial_programs = [];
      memDb.project_financial_programs.push(record);
      saveMemTable('project_financial_programs');
    }

    await this._recordAudit(user?.id, programId, 'FINANCIAL_PROGRAM_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع قائمة البرامج المالية مع حل المعرفات الذكي
   */
  async getFinancialPrograms(filters = {}) {
    let resolvedProjectId = filters.projectId;
    if (resolvedProjectId) {
      const p = await projectsEngineService.getProjectById(resolvedProjectId);
      if (p) resolvedProjectId = p.id;
    }

    let resolvedPlanId = filters.planId;
    if (resolvedPlanId) {
      const pl = await projectPortfolioEngineService.getPlanById(resolvedPlanId);
      if (pl) resolvedPlanId = pl.id;
    }

    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_financial_programs WHERE 1=1';
      const params = [];
      if (resolvedPlanId) {
        params.push(resolvedPlanId);
        q += ` AND plan_id = $${params.length}`;
      }
      if (resolvedProjectId) {
        params.push(resolvedProjectId);
        q += ` AND project_id = $${params.length}`;
      }
      if (filters.fiscalYear) {
        params.push(parseInt(filters.fiscalYear, 10));
        q += ` AND fiscal_year = $${params.length}`;
      }
      if (filters.status) {
        params.push(filters.status);
        q += ` AND status = $${params.length}`;
      }
      q += ' ORDER BY fiscal_year ASC, created_at DESC';
      list = await dbQuery(q, params);
    } else {
      list = (memDb.project_financial_programs || []).slice();
      if (resolvedPlanId) {
        list = list.filter(p => p.plan_id === resolvedPlanId || p.planId === resolvedPlanId);
      }
      if (resolvedProjectId) {
        list = list.filter(p => p.project_id === resolvedProjectId || p.projectId === resolvedProjectId);
      }
      if (filters.fiscalYear) {
        list = list.filter(p => parseInt(p.fiscal_year || p.fiscalYear, 10) === parseInt(filters.fiscalYear, 10));
      }
      if (filters.status) {
        list = list.filter(p => p.status === filters.status);
      }
      list.sort((a, b) => parseInt(a.fiscal_year || a.fiscalYear, 10) - parseInt(b.fiscal_year || b.fiscalYear, 10));
    }
    return list || [];
  }

  /**
   * استرجاع سجل مخصص مالي مفرد
   */
  async getFinancialProgramById(programId) {
    if (!programId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.project_financial_programs WHERE id = $1', [programId]);
    } else {
      return (memDb.project_financial_programs || []).find(p => p.id === programId) || null;
    }
  }

  /**
   * تعديل مخصص مالي مبرمج مع استثناء الإلغاء من قيود السقف
   */
  async updateFinancialProgram(programId, updates, user = null) {
    const existing = await this.getFinancialProgramById(programId);
    if (!existing) {
      throw new Error(`سجل البرمجة المالية [${programId}] غير موجود.`);
    }

    const targetStatus = updates.status || existing.status;
    const isCancelling = targetStatus === 'CANCELLED';

    const newAmount = updates.programmedAmount !== undefined || updates.programmed_amount !== undefined
      ? this._roundCurrency(updates.programmedAmount || updates.programmed_amount)
      : this._roundCurrency(existing.programmed_amount || existing.programmedAmount);

    if (isNaN(newAmount) || newAmount < 0) {
      throw new Error('المبلغ المبرمج غير صالح.');
    }

    const projectId = existing.project_id || existing.projectId;
    const project = await projectsEngineService.getProjectById(projectId);
    const approvedBudget = this._roundCurrency(project?.approved_budget || project?.approvedBudget || project?.budget_amount || 0);

    // فحص السقف فقط إذا لم تكن العملية إلغاء، وإذا زاد المبلغ المخصص
    if (!isCancelling && approvedBudget > 0) {
      const otherProgrammedSum = await this._getProjectOtherProgrammedSum(projectId, existing.id);
      const projectedSum = this._roundCurrency(otherProgrammedSum + newAmount);
      
      if (projectedSum > approvedBudget) {
        const remainingAllowed = Math.max(0, this._roundCurrency(approvedBudget - otherProgrammedSum));
        throw new Error(`تجاوز سقف الموازنة المعتمدة للمشروع (${approvedBudget.toLocaleString('ar-JO')} د.أ). المتاح للبرمجة حالياً: ${remainingAllowed.toLocaleString('ar-JO')} د.أ.`);
      }
    }

    const updated = {
      ...existing,
      programmed_amount: newAmount,
      funding_source: updates.fundingSource || updates.funding_source || existing.funding_source || existing.fundingSource,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      status: targetStatus,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.project_financial_programs
        SET programmed_amount = $1, funding_source = $2, notes = $3, status = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6
      `, [updated.programmed_amount, updated.funding_source, updated.notes, updated.status, user?.id || 'SYSTEM', existing.id]);
    } else {
      const idx = (memDb.project_financial_programs || []).findIndex(p => p.id === existing.id);
      if (idx !== -1) {
        memDb.project_financial_programs[idx] = { ...memDb.project_financial_programs[idx], ...updated };
        saveMemTable('project_financial_programs');
      }
    }

    const action = updated.status === 'APPROVED' 
      ? 'FINANCIAL_PROGRAM_APPROVED' 
      : (updated.status === 'CANCELLED' ? 'FINANCIAL_PROGRAM_CANCELLED' : 'FINANCIAL_PROGRAM_UPDATED');
      
    await this._recordAudit(user?.id, existing.id, action, existing, updated);
    return updated;
  }

  /**
   * حذف مخصص مالي مبرمج
   */
  async deleteFinancialProgram(programId, user = null) {
    const existing = await this.getFinancialProgramById(programId);
    if (!existing) {
      throw new Error(`سجل البرمجة المالية [${programId}] غير موجود.`);
    }

    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_financial_programs WHERE id = $1', [existing.id]);
    } else {
      if (memDb.project_financial_programs) {
        memDb.project_financial_programs = memDb.project_financial_programs.filter(p => p.id !== existing.id);
        saveMemTable('project_financial_programs');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'FINANCIAL_PROGRAM_DELETED', existing, null);
    return { success: true, message: 'تم حذف مخصص البرمجة المالية بنجاح.' };
  }

  /**
   * استرجاع مخصصات مشروع محدد ومقارنتها بسقف الموازنة
   */
  async getProjectFinancialProgram(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    const allocations = await this.getFinancialPrograms({ projectId: actualProjectId });
    const summary = await this.calculateProgrammedTotal(actualProjectId);

    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      ...summary,
      allocations
    };
  }

  /**
   * استرجاع المخصصات المبرمجة لخطة محددة مع استبعاد الملغاة بدقة
   */
  async getPlanFinancialProgram(planId) {
    const plan = await projectPortfolioEngineService.getPlanById(planId);
    if (!plan) return null;

    const actualPlanId = plan.id;
    const allocations = await this.getFinancialPrograms({ planId: actualPlanId });

    let totalPlannedAmount = 0;
    let activeCount = 0;

    allocations.forEach(a => {
      if (a.status !== 'CANCELLED') {
        activeCount++;
        totalPlannedAmount += parseFloat(a.programmed_amount || a.programmedAmount || 0);
      }
    });

    return {
      planId: actualPlanId,
      planNumber: plan.plan_number || plan.planNumber,
      planName: plan.plan_name || plan.planName,
      year: plan.year,
      totalPlannedAmount: this._roundCurrency(totalPlannedAmount),
      allocationsCount: allocations.length,
      activeAllocationsCount: activeCount,
      allocations
    };
  }

  /**
   * احتساب إجمالي المبالغ المبرمجة لمشروع والمتبقي غير المبرمج
   */
  async calculateProgrammedTotal(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const approvedBudget = this._roundCurrency(project.approved_budget || project.approvedBudget || project.budget_amount || project.budgetAmount || 0);

    const allocations = await this.getFinancialPrograms({ projectId: actualProjectId });
    let totalProgrammedAmount = 0;

    allocations.forEach(a => {
      if (a.status !== 'CANCELLED') {
        totalProgrammedAmount += parseFloat(a.programmed_amount || a.programmedAmount || 0);
      }
    });

    totalProgrammedAmount = this._roundCurrency(totalProgrammedAmount);
    const remainingBudget = Math.max(0, this._roundCurrency(approvedBudget - totalProgrammedAmount));

    return {
      projectId: actualProjectId,
      approvedBudget,
      totalProgrammedAmount,
      remainingBudget,
      isFullyProgrammed: totalProgrammedAmount >= approvedBudget && approvedBudget > 0,
      programmingPercentage: approvedBudget > 0 ? Math.min(100, Math.round((totalProgrammedAmount / approvedBudget) * 100)) : 0
    };
  }

  /**
   * احتساب إجمالي المخصصات المبرمجة لخطة في سنة مالية محددة
   */
  async calculateAnnualProgrammedTotal(planId, fiscalYear) {
    const list = await this.getFinancialPrograms({ planId, fiscalYear });
    let totalProgrammedAmount = 0;
    const uniqueProjects = new Set();

    list.forEach(item => {
      if (item.status !== 'CANCELLED') {
        totalProgrammedAmount += parseFloat(item.programmed_amount || item.programmedAmount || 0);
        uniqueProjects.add(item.project_id || item.projectId);
      }
    });

    return {
      planId,
      fiscalYear: parseInt(fiscalYear, 10),
      totalProgrammedAmount: this._roundCurrency(totalProgrammedAmount),
      projectCount: uniqueProjects.size,
      allocationsCount: list.filter(item => item.status !== 'CANCELLED').length
    };
  }

  /**
   * حساب المبلغ المتبقي المتاح للبرمجة لمشروع معين
   */
  async calculateRemainingProgramAmount(projectId) {
    const res = await this.calculateProgrammedTotal(projectId);
    return res.remainingBudget;
  }

  /**
   * حساب مجموع المخصصات لمشروع باستثناء سجل محدد مع عزل الملغاة
   */
  async _getProjectOtherProgrammedSum(projectId, excludeProgramId = null) {
    let sum = 0;
    if (isPostgresActive()) {
      let q = "SELECT COALESCE(SUM(programmed_amount), 0) as total FROM public.project_financial_programs WHERE project_id = $1 AND status != 'CANCELLED'";
      const params = [projectId];
      if (excludeProgramId) {
        params.push(excludeProgramId);
        q += ` AND id != $${params.length}`;
      }
      const r = await dbGet(q, params);
      sum = parseFloat(r?.total || 0);
    } else {
      const records = (memDb.project_financial_programs || []).filter(p => 
        (p.project_id === projectId || p.projectId === projectId) &&
        p.id !== excludeProgramId &&
        p.status !== 'CANCELLED'
      );
      records.forEach(r => sum += parseFloat(r.programmed_amount || r.programmedAmount || 0));
    }
    return this._roundCurrency(sum);
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalAllocations = 0;
    let totalProgrammedAmount = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet("SELECT COUNT(*) as count, COALESCE(SUM(programmed_amount), 0) as total FROM public.project_financial_programs WHERE status != 'CANCELLED'");
        totalAllocations = parseInt(res?.count || 0, 10);
        totalProgrammedAmount = parseFloat(res?.total || 0);
      } else {
        const active = (memDb.project_financial_programs || []).filter(p => p.status !== 'CANCELLED');
        totalAllocations = active.length;
        active.forEach(a => totalProgrammedAmount += parseFloat(a.programmed_amount || a.programmedAmount || 0));
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalAllocations,
        totalProgrammedAmount: this._roundCurrency(totalProgrammedAmount),
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

module.exports = new ProjectFinancialProgrammingEngineService();

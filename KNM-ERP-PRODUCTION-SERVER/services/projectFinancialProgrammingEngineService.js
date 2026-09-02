/**
 * services/projectFinancialProgrammingEngineService.js
 * 💵 محرك البرمجة والتخصيص المالي السنوي ومتعدد السنوات للمشاريع (PROJECT_FINANCIAL_PROGRAMMING_ENGINE — Phase 04-C)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة المخصصات المالية التخطيطية السنوية ومتعددة السنوات دون المساس ببيانات المشاريع الأصلية أو العقود أو المطالبات.
 * 2. الحفاظ على PROJECTS_ENGINE كمصدر وحيد للموازنة المعتمدة والتكلفة الفعلية.
 * 3. حوكمة سقف الموازنة: مجموع المخصصات المبرمجة لا يجوز أن يتجاوز سقف الموازنة المعتمدة للمشروع.
 * 4. دعم البرمجة الجزئية وتوزيع الالتزامات على سنوات مالية متعاقبة.
 * 5. التدقيق الشامل لكافة عمليات البرمجة والتخصيص المالي.
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
    this.version = '1.0.0';
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
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء البرمجة المالية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'البرمجة والتخصيص المالي للمشاريع', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-FINPROG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'البرمجة والتخصيص المالي للمشاريع',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('ProjectFinancialProgrammingEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * إنشاء مخصص برمجة مالية سنوية لمشروع ضمن خطة
   */
  async createFinancialProgram(data, user = null) {
    const planId = data.planId || data.plan_id;
    const projectId = data.projectId || data.project_id;
    const fiscalYear = parseInt(data.fiscalYear || data.fiscal_year || new Date().getFullYear(), 10);
    const programmedAmount = parseFloat(data.programmedAmount || data.programmed_amount || 0);

    if (!planId) throw new Error('معرف الخطة (planId) حقل إلزامي.');
    if (!projectId) throw new Error('معرف المشروع (projectId) حقل إلزامي.');
    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new Error('السنة المالية (fiscalYear) غير صالحة.');
    }
    if (isNaN(programmedAmount) || programmedAmount < 0) {
      throw new Error('المبلغ المبرمج (programmedAmount) يجب أن يكون قيمة موجبة أو صفر.');
    }

    // 1. التحقق من وجود المشروع عبر PROJECTS_ENGINE
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) {
      throw new Error(`المشروع الهندسي [${projectId}] غير موجود.`);
    }

    // 2. التحقق من وجود الخطة عبر PROJECT_PORTFOLIO_ENGINE
    const plan = await projectPortfolioEngineService.getPlanById(planId);
    if (!plan) {
      throw new Error(`الخطة الهندسية [${planId}] غير موجودة.`);
    }

    const actualProjectId = project.id;
    const actualPlanId = plan.id;

    // 3. فحص منع تكرار نفس السنة للمشروع في نفس الخطة
    let duplicate = null;
    if (isPostgresActive()) {
      duplicate = await dbGet('SELECT id FROM public.project_financial_programs WHERE plan_id = $1 AND project_id = $2 AND fiscal_year = $3', [actualPlanId, actualProjectId, fiscalYear]);
    } else {
      duplicate = (memDb.project_financial_programs || []).find(p => (p.plan_id === actualPlanId || p.planId === actualPlanId) && (p.project_id === actualProjectId || p.projectId === actualProjectId) && parseInt(p.fiscal_year || p.fiscalYear, 10) === fiscalYear);
    }
    if (duplicate) {
      throw new Error(`توجد مخصصات مبرمجة مسبقاً لهذا المشروع للسنة المالية [${fiscalYear}] في الخطة [${plan.plan_number || actualPlanId}].`);
    }

    // 4. فحص سقف الموازنة المعتمدة للمشروع (Approved Budget Ceiling Validation)
    const approvedBudget = parseFloat(project.approved_budget || project.approvedBudget || project.budget_amount || project.budgetAmount || 0);
    const existingProgrammedTotal = await this._getProjectOtherProgrammedSum(actualProjectId, null);

    if (approvedBudget > 0 && (existingProgrammedTotal + programmedAmount) > approvedBudget) {
      const remainingAllowed = Math.max(0, approvedBudget - existingProgrammedTotal);
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
   * استرجاع قائمة البرامج المالية مع الفلاتر
   */
  async getFinancialPrograms(filters = {}) {
    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_financial_programs WHERE 1=1';
      const params = [];
      if (filters.planId) {
        params.push(filters.planId);
        q += ` AND plan_id = $${params.length}`;
      }
      if (filters.projectId) {
        params.push(filters.projectId);
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
      if (filters.planId) {
        list = list.filter(p => p.plan_id === filters.planId || p.planId === filters.planId);
      }
      if (filters.projectId) {
        list = list.filter(p => p.project_id === filters.projectId || p.projectId === filters.projectId);
      }
      if (filters.fiscalYear) {
        list = list.filter(p => parseInt(p.fiscal_year || p.fiscalYear, 10) === parseInt(filters.fiscalYear, 10));
      }
      if (filters.status) {
        list = list.filter(p => p.status === filters.status);
      }
      list.sort((a, b) => parseInt(a.fiscal_year || a.fiscalYear, 10) - parseInt(b.fiscal_year || b.fiscalYear, 10));
    }
    return list;
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
   * تعديل مخصص مالي مبرمج
   */
  async updateFinancialProgram(programId, updates, user = null) {
    const existing = await this.getFinancialProgramById(programId);
    if (!existing) {
      throw new Error(`سجل البرمجة المالية [${programId}] غير موجود.`);
    }

    const newAmount = updates.programmedAmount !== undefined || updates.programmed_amount !== undefined
      ? parseFloat(updates.programmedAmount || updates.programmed_amount)
      : parseFloat(existing.programmed_amount || existing.programmedAmount);

    if (isNaN(newAmount) || newAmount < 0) {
      throw new Error('المبلغ المبرمج غير صالح.');
    }

    const projectId = existing.project_id || existing.projectId;
    const project = await projectsEngineService.getProjectById(projectId);
    const approvedBudget = parseFloat(project?.approved_budget || project?.approvedBudget || project?.budget_amount || 0);

    // فحص السقف عند تعديل المبلغ
    const otherProgrammedSum = await this._getProjectOtherProgrammedSum(projectId, existing.id);
    if (approvedBudget > 0 && (otherProgrammedSum + newAmount) > approvedBudget) {
      const remainingAllowed = Math.max(0, approvedBudget - otherProgrammedSum);
      throw new Error(`تجاوز سقف الموازنة المعتمدة للمشروع (${approvedBudget.toLocaleString('ar-JO')} د.أ). المتاح للبرمجة حالياً: ${remainingAllowed.toLocaleString('ar-JO')} د.أ.`);
    }

    const updated = {
      ...existing,
      programmed_amount: newAmount,
      funding_source: updates.fundingSource || updates.funding_source || existing.funding_source || existing.fundingSource,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      status: updates.status || existing.status,
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

    const action = updated.status === 'APPROVED' ? 'FINANCIAL_PROGRAM_APPROVED' : (updated.status === 'CANCELLED' ? 'FINANCIAL_PROGRAM_CANCELLED' : 'FINANCIAL_PROGRAM_UPDATED');
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
   * استرجاع المخصصات المبرمجة لخطة محددة
   */
  async getPlanFinancialProgram(planId) {
    const plan = await projectPortfolioEngineService.getPlanById(planId);
    if (!plan) return null;

    const actualPlanId = plan.id;
    const allocations = await this.getFinancialPrograms({ planId: actualPlanId });

    let totalPlannedAmount = 0;
    allocations.forEach(a => {
      totalPlannedAmount += parseFloat(a.programmed_amount || a.programmedAmount || 0);
    });

    return {
      planId: actualPlanId,
      planNumber: plan.plan_number || plan.planNumber,
      planName: plan.plan_name || plan.planName,
      year: plan.year,
      totalPlannedAmount: Math.round(totalPlannedAmount * 100) / 100,
      allocationsCount: allocations.length,
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
    const approvedBudget = parseFloat(project.approved_budget || project.approvedBudget || project.budget_amount || project.budgetAmount || 0);

    const allocations = await this.getFinancialPrograms({ projectId: actualProjectId });
    let totalProgrammedAmount = 0;
    allocations.forEach(a => {
      if (a.status !== 'CANCELLED') {
        totalProgrammedAmount += parseFloat(a.programmed_amount || a.programmedAmount || 0);
      }
    });

    totalProgrammedAmount = Math.round(totalProgrammedAmount * 100) / 100;
    const remainingBudget = Math.max(0, Math.round((approvedBudget - totalProgrammedAmount) * 100) / 100);

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
      totalProgrammedAmount: Math.round(totalProgrammedAmount * 100) / 100,
      projectCount: uniqueProjects.size,
      allocationsCount: list.length
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
   * حساب مجموع المخصصات لمشروع باستثناء سجل محدد
   */
  async _getProjectOtherProgrammedSum(projectId, excludeProgramId = null) {
    let sum = 0;
    if (isPostgresActive()) {
      let q = "SELECT SUM(programmed_amount) as total FROM public.project_financial_programs WHERE project_id = $1 AND status != 'CANCELLED'";
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
    return sum;
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
        totalProgrammedAmount: Math.round(totalProgrammedAmount * 100) / 100,
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

const projectFinancialProgrammingEngineService = new ProjectFinancialProgrammingEngineService();
module.exports = projectFinancialProgrammingEngineService;

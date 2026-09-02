/**
 * services/projectPortfolioEngineService.js
 * 📁 محرك إدارة محافظ وخطط المشاريع الهندسية (PROJECT_PORTFOLIO_ENGINE — Phase 04-A Foundation)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة المحافظ الرأسمالية والخطط السنوية والاستراتيجية دون استنساخ بيانات المشاريع.
 * 2. الحفاظ الكامل على PROJECTS_ENGINE كمصدر الحقيقة والبيانات لكافة سجلات المشاريع الفردية.
 * 3. الترقيم الذري التلقائي عبر NUMBERING_ENGINE بصيغ (POR-YYYY-XXXX) و (PLN-YYYY-XXXX).
 * 4. الحذف الآمن الذي ينظف الجداول الوسيطة دون المساس بالمشاريع الهندسية.
 * 5. التدقيق الشامل والرقابة على كافة عمليات الإنشاء والربط والتعديل.
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
const projectsEngineService = require('./projectsEngineService');
const { logInfo, logWarn, logError } = require('./loggerService');

class ProjectPortfolioEngineService {
  constructor() {
    this.engineId = 'PROJECT_PORTFOLIO_ENGINE';
    this.engineName = 'Enterprise Project Portfolio & Planning Engine';
    this.version = '1.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'portfolio_aggregate',
      'plan_management',
      'project_linking'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء المحافظ والخطط [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'محافظ وخطط المشاريع', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-POR-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'محافظ وخطط المشاريع',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('ProjectPortfolioEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة المحافظ الاستثمارية الرأسمالية (Portfolios Management)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء محفظة رأسمالية جديدة
   */
  async createPortfolio(data, user = null) {
    const portfolioNumber = data.portfolioNumber || (await numberingEngine.generateNextId('portfolios'));
    const portfolioId = data.id || portfolioNumber;

    const record = {
      id: portfolioId,
      portfolio_number: portfolioNumber,
      name: data.name || data.portfolioName || 'محفظة مشاريع جديدة',
      description: data.description || '',
      status: data.status || 'ACTIVE',
      directorate_id: data.directorateId || 'DIR-ENG',
      department_id: data.departmentId || 'DEPT-PROJECTS',
      section_id: data.sectionId || null,
      created_by: user?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_portfolios
        (id, portfolio_number, name, description, status, directorate_id, department_id, section_id, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, Object.values(record));
    } else {
      if (!memDb.project_portfolios) memDb.project_portfolios = [];
      memDb.project_portfolios.unshift(record);
      saveMemTable('project_portfolios');
    }

    await this._recordAudit(user?.id, portfolioId, 'PORTFOLIO_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع قائمة المحافظ مع الفلاتر
   */
  async getPortfolios(filters = {}, user = null) {
    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_portfolios WHERE 1=1';
      const params = [];
      if (filters.status) {
        params.push(filters.status);
        q += ` AND status = $${params.length}`;
      }
      if (filters.departmentId) {
        params.push(filters.departmentId);
        q += ` AND department_id = $${params.length}`;
      }
      if (filters.search) {
        params.push(`%${filters.search}%`);
        q += ` AND (name ILIKE $${params.length} OR portfolio_number ILIKE $${params.length})`;
      }
      q += ' ORDER BY created_at DESC';
      list = await dbQuery(q, params);
    } else {
      list = (memDb.project_portfolios || []).slice();
      if (filters.status) {
        list = list.filter(p => p.status === filters.status);
      }
      if (filters.departmentId) {
        list = list.filter(p => p.departmentId === filters.departmentId || p.department_id === filters.departmentId);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(s) ||
          (p.portfolio_number || p.portfolioNumber || '').toLowerCase().includes(s)
        );
      }
      list.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    }

    return list;
  }

  /**
   * استرجاع محفظة مفردة مع قائمة المشاريع المرتبطة بها
   */
  async getPortfolioById(portfolioId) {
    if (!portfolioId) return null;
    let portfolio = null;

    if (isPostgresActive()) {
      portfolio = await dbGet('SELECT * FROM public.project_portfolios WHERE id = $1 OR portfolio_number = $1', [portfolioId]);
    } else {
      portfolio = (memDb.project_portfolios || []).find(p => p.id === portfolioId || p.portfolio_number === portfolioId || p.portfolioNumber === portfolioId);
    }

    if (!portfolio) return null;
    const actualId = portfolio.id;

    // استرجاع معرفات المشاريع المرتبطة
    let projectIds = [];
    if (isPostgresActive()) {
      const rows = await dbQuery('SELECT project_id FROM public.project_portfolio_projects WHERE portfolio_id = $1', [actualId]);
      projectIds = rows.map(r => r.project_id);
    } else {
      const relations = (memDb.project_portfolio_projects || []).filter(r => r.portfolio_id === actualId || r.portfolioId === actualId);
      projectIds = relations.map(r => r.project_id || r.projectId);
    }

    // جلب بيانات المشاريع من PROJECTS_ENGINE دون تكرار أو استنساخ
    const projects = [];
    for (const pId of projectIds) {
      const p = await projectsEngineService.getProjectById(pId);
      if (p) projects.push(p);
    }

    return {
      ...portfolio,
      projectCount: projects.length,
      projects
    };
  }

  /**
   * تعديل محفظة
   */
  async updatePortfolio(portfolioId, updates, user = null) {
    const existing = await this.getPortfolioById(portfolioId);
    if (!existing) {
      throw new Error(`المحفظة [${portfolioId}] غير موجودة.`);
    }

    const updated = {
      ...existing,
      ...updates,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.project_portfolios
        SET name = $1, description = $2, status = $3, directorate_id = $4, department_id = $5, updated_by = $6, updated_at = NOW()
        WHERE id = $7
      `, [
        updated.name,
        updated.description,
        updated.status,
        updated.directorate_id || updated.directorateId,
        updated.department_id || updated.departmentId,
        user?.id || 'SYSTEM',
        existing.id
      ]);
    } else {
      const idx = (memDb.project_portfolios || []).findIndex(p => p.id === existing.id);
      if (idx !== -1) {
        memDb.project_portfolios[idx] = { ...memDb.project_portfolios[idx], ...updated };
        saveMemTable('project_portfolios');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PORTFOLIO_UPDATED', existing, updated);
    return updated;
  }

  /**
   * حذف محفظة (حذف آمن: ينظف العلاقات فقط دون حذف المشاريع)
   */
  async deletePortfolio(portfolioId, user = null) {
    const existing = await this.getPortfolioById(portfolioId);
    if (!existing) {
      throw new Error(`المحفظة [${portfolioId}] غير موجودة.`);
    }

    const actualId = existing.id;
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_portfolio_projects WHERE portfolio_id = $1', [actualId]);
      await dbRun('DELETE FROM public.project_portfolios WHERE id = $1', [actualId]);
    } else {
      if (memDb.project_portfolio_projects) {
        memDb.project_portfolio_projects = memDb.project_portfolio_projects.filter(r => r.portfolio_id !== actualId && r.portfolioId !== actualId);
        saveMemTable('project_portfolio_projects');
      }
      if (memDb.project_portfolios) {
        memDb.project_portfolios = memDb.project_portfolios.filter(p => p.id !== actualId);
        saveMemTable('project_portfolios');
      }
    }

    await this._recordAudit(user?.id, actualId, 'PORTFOLIO_DELETED', existing, null);
    return { success: true, message: 'تم حذف المحفظة وعلاقاتها بنجاح دون المساس بسجلات المشاريع الأصلية.' };
  }

  /**
   * ربط مشروع بمحفظة
   */
  async addProjectToPortfolio(portfolioId, projectId, user = null) {
    const portfolio = await this.getPortfolioById(portfolioId);
    if (!portfolio) throw new Error(`المحفظة [${portfolioId}] غير موجودة.`);

    // التحقق من وجود المشروع عبر PROJECTS_ENGINE
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع الهندسي [${projectId}] غير موجود في قاعدة المشاريع.`);

    const actualPortfolioId = portfolio.id;
    const actualProjectId = project.id;

    // فحص منع التكرار
    let alreadyExists = false;
    if (isPostgresActive()) {
      const existingRel = await dbGet('SELECT * FROM public.project_portfolio_projects WHERE portfolio_id = $1 AND project_id = $2', [actualPortfolioId, actualProjectId]);
      alreadyExists = !!existingRel;
    } else {
      alreadyExists = (memDb.project_portfolio_projects || []).some(r => (r.portfolio_id === actualPortfolioId || r.portfolioId === actualPortfolioId) && (r.project_id === actualProjectId || r.projectId === actualProjectId));
    }

    if (alreadyExists) {
      throw new Error(`المشروع [${project.project_number || actualProjectId}] مضاف مسبقاً إلى هذه المحفظة.`);
    }

    const relRecord = {
      id: `PPR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      portfolio_id: actualPortfolioId,
      project_id: actualProjectId,
      created_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun('INSERT INTO public.project_portfolio_projects (id, portfolio_id, project_id, created_at) VALUES ($1, $2, $3, $4)', Object.values(relRecord));
    } else {
      if (!memDb.project_portfolio_projects) memDb.project_portfolio_projects = [];
      memDb.project_portfolio_projects.push(relRecord);
      saveMemTable('project_portfolio_projects');
    }

    await this._recordAudit(user?.id, actualPortfolioId, 'PROJECT_ADDED_TO_PORTFOLIO', null, { portfolioId: actualPortfolioId, projectId: actualProjectId });
    return { success: true, message: 'تم إدراج المشروع في المحفظة بنجاح.', relation: relRecord };
  }

  /**
   * فك ارتباط مشروع من محفظة
   */
  async removeProjectFromPortfolio(portfolioId, projectId, user = null) {
    const portfolio = await this.getPortfolioById(portfolioId);
    if (!portfolio) throw new Error(`المحفظة [${portfolioId}] غير موجودة.`);

    const actualPortfolioId = portfolio.id;
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_portfolio_projects WHERE portfolio_id = $1 AND (project_id = $2 OR project_id IN (SELECT id FROM public.projects WHERE project_number = $2))', [actualPortfolioId, projectId]);
    } else {
      if (memDb.project_portfolio_projects) {
        memDb.project_portfolio_projects = memDb.project_portfolio_projects.filter(r => !( (r.portfolio_id === actualPortfolioId || r.portfolioId === actualPortfolioId) && (r.project_id === projectId || r.projectId === projectId) ));
        saveMemTable('project_portfolio_projects');
      }
    }

    await this._recordAudit(user?.id, actualPortfolioId, 'PROJECT_REMOVED_FROM_PORTFOLIO', { portfolioId: actualPortfolioId, projectId }, null);
    return { success: true, message: 'تمت إزالة المشروع من المحفظة بنجاح.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة الخطط السنوية والاستراتيجية (Plans Management)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء خطة هندسية جديدة
   */
  async createPlan(data, user = null) {
    const planNumber = data.planNumber || (await numberingEngine.generateNextId('plans'));
    const planId = data.id || planNumber;
    const currentYear = new Date().getFullYear();

    const record = {
      id: planId,
      plan_number: planNumber,
      plan_name: data.planName || data.name || `الخطة الهندسية السنوية ${data.year || currentYear}`,
      plan_type: data.planType || 'ANNUAL',
      year: parseInt(data.year || currentYear, 10),
      start_date: data.startDate || `${data.year || currentYear}-01-01`,
      end_date: data.endDate || `${data.year || currentYear}-12-31`,
      status: data.status || 'DRAFT',
      directorate_id: data.directorateId || 'DIR-ENG',
      department_id: data.departmentId || 'DEPT-PROJECTS',
      section_id: data.sectionId || null,
      description: data.description || '',
      created_by: user?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_plans
        (id, plan_number, plan_name, plan_type, year, start_date, end_date, status, directorate_id, department_id, section_id, description, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, Object.values(record));
    } else {
      if (!memDb.project_plans) memDb.project_plans = [];
      memDb.project_plans.unshift(record);
      saveMemTable('project_plans');
    }

    await this._recordAudit(user?.id, planId, 'PLAN_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع قائمة الخطط مع الفلاتر
   */
  async getPlans(filters = {}, user = null) {
    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_plans WHERE 1=1';
      const params = [];
      if (filters.status) {
        params.push(filters.status);
        q += ` AND status = $${params.length}`;
      }
      if (filters.planType) {
        params.push(filters.planType);
        q += ` AND plan_type = $${params.length}`;
      }
      if (filters.year) {
        params.push(parseInt(filters.year, 10));
        q += ` AND year = $${params.length}`;
      }
      if (filters.search) {
        params.push(`%${filters.search}%`);
        q += ` AND (plan_name ILIKE $${params.length} OR plan_number ILIKE $${params.length})`;
      }
      q += ' ORDER BY year DESC, created_at DESC';
      list = await dbQuery(q, params);
    } else {
      list = (memDb.project_plans || []).slice();
      if (filters.status) {
        list = list.filter(p => p.status === filters.status);
      }
      if (filters.planType) {
        list = list.filter(p => p.plan_type === filters.planType || p.planType === filters.planType);
      }
      if (filters.year) {
        list = list.filter(p => p.year === parseInt(filters.year, 10));
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(p =>
          (p.plan_name || p.planName || '').toLowerCase().includes(s) ||
          (p.plan_number || p.planNumber || '').toLowerCase().includes(s)
        );
      }
      list.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    }

    return list;
  }

  /**
   * استرجاع تفاصيل خطة مفردة مع المشاريع المبرمجة فيها
   */
  async getPlanById(planId) {
    if (!planId) return null;
    let plan = null;

    if (isPostgresActive()) {
      plan = await dbGet('SELECT * FROM public.project_plans WHERE id = $1 OR plan_number = $1', [planId]);
    } else {
      plan = (memDb.project_plans || []).find(p => p.id === planId || p.plan_number === planId || p.planNumber === planId);
    }

    if (!plan) return null;
    const actualId = plan.id;

    // استرجاع معرفات المشاريع المرتبطة بالخطة
    let projectIds = [];
    if (isPostgresActive()) {
      const rows = await dbQuery('SELECT project_id FROM public.project_plan_projects WHERE plan_id = $1', [actualId]);
      projectIds = rows.map(r => r.project_id);
    } else {
      const relations = (memDb.project_plan_projects || []).filter(r => r.plan_id === actualId || r.planId === actualId);
      projectIds = relations.map(r => r.project_id || r.projectId);
    }

    // جلب بيانات المشاريع من PROJECTS_ENGINE
    const projects = [];
    for (const pId of projectIds) {
      const p = await projectsEngineService.getProjectById(pId);
      if (p) projects.push(p);
    }

    return {
      ...plan,
      projectCount: projects.length,
      projects
    };
  }

  /**
   * تعديل خطة هندسية
   */
  async updatePlan(planId, updates, user = null) {
    const existing = await this.getPlanById(planId);
    if (!existing) {
      throw new Error(`الخطة [${planId}] غير موجودة.`);
    }

    const updated = {
      ...existing,
      ...updates,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.project_plans
        SET plan_name = $1, plan_type = $2, year = $3, start_date = $4, end_date = $5,
            status = $6, description = $7, directorate_id = $8, department_id = $9, updated_by = $10, updated_at = NOW()
        WHERE id = $11
      `, [
        updated.plan_name || updated.planName,
        updated.plan_type || updated.planType,
        parseInt(updated.year, 10),
        updated.start_date || updated.startDate,
        updated.end_date || updated.endDate,
        updated.status,
        updated.description,
        updated.directorate_id || updated.directorateId,
        updated.department_id || updated.departmentId,
        user?.id || 'SYSTEM',
        existing.id
      ]);
    } else {
      const idx = (memDb.project_plans || []).findIndex(p => p.id === existing.id);
      if (idx !== -1) {
        memDb.project_plans[idx] = { ...memDb.project_plans[idx], ...updated };
        saveMemTable('project_plans');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PLAN_UPDATED', existing, updated);
    return updated;
  }

  /**
   * حذف خطة (حذف آمن: ينظف علاقات الخطة فقط دون حذف المشاريع)
   */
  async deletePlan(planId, user = null) {
    const existing = await this.getPlanById(planId);
    if (!existing) {
      throw new Error(`الخطة [${planId}] غير موجودة.`);
    }

    const actualId = existing.id;
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_plan_projects WHERE plan_id = $1', [actualId]);
      await dbRun('DELETE FROM public.project_plans WHERE id = $1', [actualId]);
    } else {
      if (memDb.project_plan_projects) {
        memDb.project_plan_projects = memDb.project_plan_projects.filter(r => r.plan_id !== actualId && r.planId !== actualId);
        saveMemTable('project_plan_projects');
      }
      if (memDb.project_plans) {
        memDb.project_plans = memDb.project_plans.filter(p => p.id !== actualId);
        saveMemTable('project_plans');
      }
    }

    await this._recordAudit(user?.id, actualId, 'PLAN_DELETED', existing, null);
    return { success: true, message: 'تم حذف الخطة وعلاقاتها بنجاح دون المساس بالمشاريع الهندسية.' };
  }

  /**
   * إضافة مشروع إلى خطة
   */
  async addProjectToPlan(planId, projectId, user = null) {
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error(`الخطة [${planId}] غير موجودة.`);

    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع الهندسي [${projectId}] غير موجود في قاعدة المشاريع.`);

    const actualPlanId = plan.id;
    const actualProjectId = project.id;

    // فحص منع التكرار
    let alreadyExists = false;
    if (isPostgresActive()) {
      const existingRel = await dbGet('SELECT * FROM public.project_plan_projects WHERE plan_id = $1 AND project_id = $2', [actualPlanId, actualProjectId]);
      alreadyExists = !!existingRel;
    } else {
      alreadyExists = (memDb.project_plan_projects || []).some(r => (r.plan_id === actualPlanId || r.planId === actualPlanId) && (r.project_id === actualProjectId || r.projectId === actualProjectId));
    }

    if (alreadyExists) {
      throw new Error(`المشروع [${project.project_number || actualProjectId}] مضاف مسبقاً إلى هذه الخطة.`);
    }

    const relRecord = {
      id: `PLPR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      plan_id: actualPlanId,
      project_id: actualProjectId,
      created_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun('INSERT INTO public.project_plan_projects (id, plan_id, project_id, created_at) VALUES ($1, $2, $3, $4)', Object.values(relRecord));
    } else {
      if (!memDb.project_plan_projects) memDb.project_plan_projects = [];
      memDb.project_plan_projects.push(relRecord);
      saveMemTable('project_plan_projects');
    }

    await this._recordAudit(user?.id, actualPlanId, 'PROJECT_ADDED_TO_PLAN', null, { planId: actualPlanId, projectId: actualProjectId });
    return { success: true, message: 'تم ربط المشروع بالخطة بنجاح.', relation: relRecord };
  }

  /**
   * فك ارتباط مشروع من خطة
   */
  async removeProjectFromPlan(planId, projectId, user = null) {
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error(`الخطة [${planId}] غير موجودة.`);

    const actualPlanId = plan.id;
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_plan_projects WHERE plan_id = $1 AND (project_id = $2 OR project_id IN (SELECT id FROM public.projects WHERE project_number = $2))', [actualPlanId, projectId]);
    } else {
      if (memDb.project_plan_projects) {
        memDb.project_plan_projects = memDb.project_plan_projects.filter(r => !( (r.plan_id === actualPlanId || r.planId === actualPlanId) && (r.project_id === projectId || r.projectId === projectId) ));
        saveMemTable('project_plan_projects');
      }
    }

    await this._recordAudit(user?.id, actualPlanId, 'PROJECT_REMOVED_FROM_PLAN', { planId: actualPlanId, projectId }, null);
    return { success: true, message: 'تمت إزالة المشروع من الخطة بنجاح.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ مؤشرات الأداء الكلية للمحافظ والمشاريع (Integrated Portfolio KPIs — Phase 04-F)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع مؤشرات الأداء المتكاملة لكافة المحافظ والخطط والمشاريع
   */
  async getIntegratedPortfolioKPIs(filters = {}) {
    const portfolios = await this.getPortfolios(filters);
    const plans = await this.getPlans(filters);
    const allProjects = await projectsEngineService.getProjects(filters);

    let totalBudget = 0;
    let totalActualCost = 0;
    let totalProgressSum = 0;
    const statusCounts = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, IN_PROGRESS: 0, SUSPENDED: 0, COMPLETED: 0, CLOSED: 0, CANCELLED: 0 };

    allProjects.forEach(p => {
      totalBudget += parseFloat(p.approved_budget || p.approvedBudget || p.budget_amount || p.budgetAmount || 0);
      totalActualCost += parseFloat(p.actual_cost || p.actualCost || 0);
      totalProgressSum += parseFloat(p.physical_progress || p.physicalProgress || p.completion_percentage || 0);
      const st = p.status || 'DRAFT';
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      else statusCounts[st] = 1;
    });

    const avgProgress = allProjects.length > 0 ? Math.round((totalProgressSum / allProjects.length) * 100) / 100 : 0;

    // تكامل الأولويات
    let topPrioritized = [];
    try {
      const projectPrioritizationEngineService = require('./projectPrioritizationEngineService');
      const ranked = await projectPrioritizationEngineService.rankProjects();
      topPrioritized = (ranked || []).slice(0, 5);
    } catch (e) {
      topPrioritized = [];
    }

    // تكامل البرمجة المالية
    let totalProgrammed = 0;
    try {
      const projectFinancialProgrammingEngineService = require('./projectFinancialProgrammingEngineService');
      const finHealth = await projectFinancialProgrammingEngineService.healthCheck();
      totalProgrammed = finHealth.totalProgrammedAmount || 0;
    } catch (e) {
      totalProgrammed = 0;
    }

    // تكامل الجدولة والمسار الحرج
    let criticalPathCount = 0;
    let conflictsCount = 0;
    try {
      const projectSchedulingEngineService = require('./projectSchedulingEngineService');
      const critRes = await projectSchedulingEngineService.getCriticalPath();
      criticalPathCount = critRes.totalCritical || 0;
      const confRes = await projectSchedulingEngineService.detectScheduleConflicts();
      conflictsCount = confRes.conflictsCount || 0;
    } catch (e) {
      criticalPathCount = 0;
      conflictsCount = 0;
    }

    // تكامل الاعتماديات
    let dependenciesCount = 0;
    try {
      const projectDependencyEngineService = require('./projectDependencyEngineService');
      const depHealth = await projectDependencyEngineService.healthCheck();
      dependenciesCount = depHealth.activeDependencies || depHealth.totalDependencies || 0;
    } catch (e) {
      dependenciesCount = 0;
    }

    return {
      overview: {
        totalPortfolios: portfolios.length,
        activePortfolios: portfolios.filter(p => p.status === 'ACTIVE').length,
        totalPlans: plans.length,
        activePlans: plans.filter(p => p.status === 'ACTIVE' || p.status === 'APPROVED').length,
        totalProjects: allProjects.length,
        averagePhysicalProgress: avgProgress
      },
      financialKPIs: {
        totalApprovedBudget: Math.round(totalBudget * 100) / 100,
        totalProgrammedAmount: Math.round(totalProgrammed * 100) / 100,
        totalActualCost: Math.round(totalActualCost * 100) / 100,
        programmingRate: totalBudget > 0 ? Math.min(100, Math.round((totalProgrammed / totalBudget) * 100)) : 0,
        financialExecutionRate: totalBudget > 0 ? Math.min(100, Math.round((totalActualCost / totalBudget) * 100)) : 0
      },
      statusBreakdown: statusCounts,
      schedulingAndDependencies: {
        activeDependenciesCount: dependenciesCount,
        criticalPathProjectsCount: criticalPathCount,
        scheduleConflictsCount: conflictsCount,
        scheduleHealthStatus: conflictsCount === 0 ? 'OPTIMAL' : 'ATTENTION_REQUIRED'
      },
      topPrioritizedProjects: topPrioritized,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * استرجاع مؤشرات الأداء لمحفظة محددة
   */
  async getPortfolioKPIs(portfolioId) {
    const portfolio = await this.getPortfolioById(portfolioId);
    if (!portfolio) throw new Error(`المحفظة [${portfolioId}] غير موجودة.`);

    const projects = portfolio.projects || [];
    let portfolioBudget = 0;
    let portfolioActualCost = 0;
    let progressSum = 0;

    projects.forEach(p => {
      portfolioBudget += parseFloat(p.approved_budget || p.approvedBudget || p.budget_amount || p.budgetAmount || 0);
      portfolioActualCost += parseFloat(p.actual_cost || p.actualCost || 0);
      progressSum += parseFloat(p.physical_progress || p.physicalProgress || p.completion_percentage || 0);
    });

    const avgProgress = projects.length > 0 ? Math.round((progressSum / projects.length) * 100) / 100 : 0;

    return {
      portfolioId: portfolio.id,
      portfolioNumber: portfolio.portfolio_number,
      portfolioName: portfolio.name,
      status: portfolio.status,
      projectsCount: projects.length,
      totalBudget: Math.round(portfolioBudget * 100) / 100,
      totalActualCost: Math.round(portfolioActualCost * 100) / 100,
      averageProgress: avgProgress,
      projectsSummary: projects.map(p => ({
        id: p.id,
        number: p.project_number,
        name: p.project_name,
        status: p.status,
        progress: p.physical_progress || p.completion_percentage || 0
      }))
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalPortfolios = 0;
    let totalPlans = 0;
    try {
      if (isPostgresActive()) {
        const porRes = await dbGet('SELECT COUNT(*) as count FROM public.project_portfolios');
        const plnRes = await dbGet('SELECT COUNT(*) as count FROM public.project_plans');
        totalPortfolios = parseInt(porRes?.count || 0, 10);
        totalPlans = parseInt(plnRes?.count || 0, 10);
      } else {
        totalPortfolios = (memDb.project_portfolios || []).length;
        totalPlans = (memDb.project_plans || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalPortfolios,
        totalPlans,
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

const projectPortfolioEngineService = new ProjectPortfolioEngineService();
module.exports = projectPortfolioEngineService;

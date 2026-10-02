/**
 * services/projectsEngineService.js
 * 🏗️ محرك إدارة المشاريع الهندسية والمحافظ الرأسمالية المركزي (PROJECTS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v2.0 - Anti-Gravity Enterprise Patch
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  withTransaction,
  memDb,
  saveMemTable
} = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const rbacManager = require('../middlewares/rbacManager');
const { logInfo, logError, logWarn } = require('./loggerService');

// دورة حياة المشروع وحالات الانتقال المسموح بها
const ALLOWED_TRANSITIONS = {
  DRAFT: ['PLANNED', 'SUBMITTED', 'CANCELLED'],
  PLANNED: ['SUBMITTED', 'DRAFT', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'DRAFT', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PROCUREMENT', 'CONTRACTED', 'IN_PROGRESS', 'CANCELLED'],
  PROCUREMENT: ['CONTRACTED', 'CANCELLED'],
  CONTRACTED: ['IN_PROGRESS', 'SUSPENDED', 'CANCELLED'],
  IN_PROGRESS: ['SUSPENDED', 'COMPLETED', 'CANCELLED'],
  SUSPENDED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: []
};

class ProjectsEngineService {
  constructor() {
    this.engineId = 'PROJECTS_ENGINE';
    this.engineName = 'Enterprise Projects & Capital Portfolio Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'project_aggregate',
      'lifecycle_workflow',
      'progress_tracking',
      'milestones_management',
      'risk_register',
      'financial_variance_analytics',
      'gis_spatial_mapping',
      'tender_contract_linking',
      'document_archive_linking'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق
   */
  async _recordAudit(userId, projectId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء مشروع [${action}] على المعرف [${projectId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المشاريع الهندسية',
        entityId: String(projectId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ProjectsEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * استرجاع قائمة المشاريع مع الفلاتر
   */
  async getProjects(filters = {}, userContext = null) {
    let projects = [];
    if (isPostgresActive()) {
      let q = 'SELECT *, ST_AsGeoJSON(geom) as geojson FROM public.projects WHERE 1=1';
      const params = [];
      if (filters.status) {
        params.push(filters.status);
        q += ` AND status = $${params.length}`;
      }
      if (filters.departmentId) {
        params.push(filters.departmentId);
        q += ` AND department_id = $${params.length}`;
      }
      if (filters.projectManagerId) {
        params.push(filters.projectManagerId);
        q += ` AND (project_manager_id = $${params.length} OR responsible_user_id = $${params.length})`;
      }
      if (filters.search) {
        params.push(`%${filters.search}%`);
        q += ` AND (project_name ILIKE $${params.length} OR project_number ILIKE $${params.length} OR location ILIKE $${params.length})`;
      }
      q += ' ORDER BY created_at DESC';
      projects = await dbQuery(q, params);
    } else {
      projects = (memDb.projects || []).slice();
      if (filters.status) {
        projects = projects.filter(p => p.status === filters.status);
      }
      if (filters.departmentId) {
        projects = projects.filter(p => p.departmentId === filters.departmentId || p.department_id === filters.departmentId);
      }
      if (filters.projectManagerId) {
        projects = projects.filter(p => p.projectManagerId === filters.projectManagerId || p.project_manager_id === filters.projectManagerId);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        projects = projects.filter(p => 
          (p.projectName || p.project_name || '').toLowerCase().includes(s) ||
          (p.projectNumber || p.project_number || '').toLowerCase().includes(s) ||
          (p.location || '').toLowerCase().includes(s)
        );
      }
      projects.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    }

    return projects || [];
  }

  /**
   * استرجاع مشروع مفرد مع كافة تفاصيله المرتبطة
   */
  async getProjectById(projectId) {
    if (!projectId) return null;
    let project = null;

    if (isPostgresActive()) {
      project = await dbGet('SELECT *, ST_AsGeoJSON(geom) as geojson FROM public.projects WHERE id = $1 OR project_number = $1', [projectId]);
    } else {
      project = (memDb.projects || []).find(p => p.id === projectId || p.projectNumber === projectId || p.project_number === projectId);
    }

    if (!project) return null;
    const actualId = project.id;

    // جلب المعالم والمراحل (Milestones)
    let milestones = [];
    if (isPostgresActive()) {
      milestones = await dbQuery('SELECT * FROM public.project_milestones WHERE project_id = $1 ORDER BY planned_date ASC', [actualId]);
    } else {
      milestones = (memDb.project_milestones || []).filter(m => m.projectId === actualId || m.project_id === actualId);
    }

    // جلب المخاطر (Risks)
    let risks = [];
    if (isPostgresActive()) {
      risks = await dbQuery('SELECT * FROM public.project_risks WHERE project_id = $1 ORDER BY created_at DESC', [actualId]);
    } else {
      risks = (memDb.project_risks || []).filter(r => r.projectId === actualId || r.project_id === actualId);
    }

    // جلب سجلات التقدم (Progress Logs)
    let progressLogs = [];
    if (isPostgresActive()) {
      progressLogs = await dbQuery('SELECT * FROM public.project_progress_logs WHERE project_id = $1 ORDER BY progress_date DESC', [actualId]);
    } else {
      progressLogs = (memDb.project_progress_logs || []).filter(pl => pl.projectId === actualId || pl.project_id === actualId);
    }

    // جلب بيانات العطاء المرتبط إن وجد
    let linkedTender = null;
    const tenderId = project.tender_id || project.tenderId;
    if (tenderId) {
      if (isPostgresActive()) {
        linkedTender = await dbGet('SELECT id, name, "tenderNumber", value, status FROM public.tenders WHERE id = $1', [tenderId]);
      } else {
        const t = (memDb.tenders || []).find(x => x.id === tenderId);
        if (t) linkedTender = { id: t.id, name: t.name, tenderNumber: t.tenderNumber || t.id, value: t.value, status: t.status };
      }
    }

    // جلب بيانات العقد المرتبط إن وجد
    let linkedContract = null;
    const contractId = project.contract_id || project.contractId;
    if (contractId) {
      if (isPostgresActive()) {
        linkedContract = await dbGet('SELECT id, contract_number, contractor_name, total_value, start_date, end_date, status FROM public.contracts WHERE id = $1', [contractId]);
      } else {
        const c = (memDb.contracts || []).find(x => x.id === contractId);
        if (c) linkedContract = { id: c.id, contractNumber: c.contractNumber || c.contract_number, contractorName: c.contractorName || c.contractor_name, totalValue: c.totalValue || c.total_value, status: c.status };
      }
    }

    const financialSummary = this.calculateFinancialSummary(project, linkedContract);

    return {
      ...project,
      milestones: milestones || [],
      risks: risks || [],
      progressLogs: progressLogs || [],
      linkedTender,
      linkedContract,
      financialSummary
    };
  }

  /**
   * حساب المؤشرات والتحليلات المالية للمشروع
   */
  calculateFinancialSummary(project, linkedContract = null) {
    const approvedBudget = parseFloat(project.approved_budget || project.approvedBudget || project.budget_amount || project.budgetAmount || 0);
    const contractedAmount = parseFloat(linkedContract?.totalValue || linkedContract?.total_value || project.contracted_amount || project.contractedAmount || 0);
    const actualCost = parseFloat(project.actual_cost || project.actualCost || 0);

    const budgetVariance = approvedBudget - actualCost;
    const contractVariance = contractedAmount > 0 ? contractedAmount - actualCost : 0;
    const financialProgress = approvedBudget > 0 ? Math.min(100, Math.round((actualCost / approvedBudget) * 100)) : 0;
    const physicalProgress = parseFloat(project.physical_progress || project.physicalProgress || project.completion_percentage || 0);
    const scheduleVariance = physicalProgress - financialProgress;

    return {
      approvedBudget,
      contractedAmount,
      actualCost,
      budgetVariance,
      contractVariance,
      financialProgress,
      physicalProgress,
      scheduleVariance,
      isUnderBudget: actualCost <= approvedBudget
    };
  }

  /**
   * إنشاء مشروع جديد برقم متسلسل ذري وإسناد سليم للأعمدة
   */
  async createProject(data, user = null) {
    const projectNumber = data.projectNumber || (await numberingEngine.generateNextId('projects'));
    const projectId = data.id || projectNumber;
    const selectedBudgetLine = data.budget_line_id || data.budgetLineId || null;
    const approvedBudgetVal = parseFloat(data.approvedBudget || data.budgetAmount || 0);

    // حجز المخصص المالي إن وجد
    if (selectedBudgetLine && approvedBudgetVal > 0) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (budgetEngineService && typeof budgetEngineService.createAllocation === 'function') {
          await budgetEngineService.createAllocation({
            budget_line_id: selectedBudgetLine,
            entity_type: 'PROJECT',
            entity_id: projectId,
            entity_name: data.projectName || data.name || 'مشروع هندسي',
            amount: approvedBudgetVal,
            status: 'COMMITTED'
          });
        }
      } catch (be) {
        logWarn('ProjectsEngine', `Budget allocation error: ${be.message}`);
        throw new Error(`تعذر إنشاء المشروع لعدم توفر مخصص مالي كافٍ: ${be.message}`);
      }
    }

    const now = new Date().toISOString();
    const projectRecord = {
      id: projectId,
      project_number: projectNumber,
      project_code: data.projectCode || projectNumber,
      project_name: data.projectName || data.name || 'مشروع هندسي جديد',
      project_type: data.projectType || 'إنشاء وتعبيد طرق',
      description: data.description || '',
      directorate_id: data.directorateId || 'DIR-ENG',
      department_id: data.departmentId || 'DEPT-PROJECTS',
      responsible_user_id: data.responsibleUserId || user?.id || null,
      project_manager_id: data.projectManagerId || user?.id || null,
      project_manager_name: data.projectManagerName || user?.fullName || 'مهندس المشاريع',
      status: 'DRAFT',
      priority: data.priority || 'MEDIUM',
      funding_source: data.fundingSource || 'موازنة البلدية',
      budget_line_id: selectedBudgetLine,
      budget_amount: parseFloat(data.budgetAmount || 0),
      approved_budget: approvedBudgetVal,
      contracted_amount: parseFloat(data.contractedAmount || 0),
      actual_cost: parseFloat(data.actualCost || 0),
      planned_start_date: data.plannedStartDate || now.split('T')[0],
      planned_end_date: data.plannedEndDate || null,
      actual_start_date: data.actualStartDate || null,
      actual_end_date: data.actualEndDate || null,
      completion_percentage: 0.00,
      physical_progress: 0.00,
      financial_progress: 0.00,
      location: data.location || 'بلدية كفرنجة',
      location_description: data.locationDescription || '',
      latitude: parseFloat(data.latitude || 32.2980),
      longitude: parseFloat(data.longitude || 35.7920),
      gis_reference: data.gisReference || null,
      geometry: data.geometry ? JSON.stringify(data.geometry) : null,
      tender_id: data.tenderId || null,
      contract_id: data.contractId || null,
      parent_project_id: data.parentProjectId || null,
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_by: user?.id || 'SYSTEM',
      updated_at: now
    };

    if (isPostgresActive()) {
      // مصفوفة مطابقة تامة 1:1 لـ 39 عموداً دون ترحيل
      const sqlColumns = [
        'id', 'project_number', 'project_code', 'project_name', 'project_type', 'description',
        'directorate_id', 'department_id', 'responsible_user_id', 'project_manager_id', 'project_manager_name',
        'status', 'priority', 'funding_source', 'budget_line_id', 'budget_amount', 'approved_budget',
        'contracted_amount', 'actual_cost', 'planned_start_date', 'planned_end_date', 'actual_start_date',
        'actual_end_date', 'completion_percentage', 'physical_progress', 'financial_progress',
        'location', 'location_description', 'latitude', 'longitude', 'gis_reference', 'geometry',
        'tender_id', 'contract_id', 'parent_project_id', 'created_by', 'created_at', 'updated_by', 'updated_at'
      ];

      const sqlPlaceholders = sqlColumns.map((_, idx) => `$${idx + 1}`).join(', ');
      const sqlValues = sqlColumns.map(col => projectRecord[col]);
      const lonParamIdx = sqlColumns.length + 1;
      const latParamIdx = sqlColumns.length + 2;
      sqlValues.push(projectRecord.longitude, projectRecord.latitude);

      await dbRun(
        `INSERT INTO public.projects (${sqlColumns.join(', ')}, geom) 
         VALUES (${sqlPlaceholders}, ST_SetSRID(ST_MakePoint($${lonParamIdx}, $${latParamIdx}), 4326))`,
        sqlValues
      );
    } else {
      if (!memDb.projects) memDb.projects = [];
      memDb.projects.unshift(projectRecord);
      saveMemTable('projects');
    }

    await this._recordAudit(user?.id, projectId, 'PROJECT_CREATED', null, projectRecord);
    return projectRecord;
  }

  /**
   * تعديل بيانات المشروع بالاستناد دائماً إلى المفتاح الحقيقي existing.id
   */
  async updateProject(projectId, updates, user = null) {
    const existing = await this.getProjectById(projectId);
    if (!existing) {
      throw new Error(`المشروع [${projectId}] غير موجود.`);
    }

    const actualId = existing.id;
    const updated = {
      ...existing,
      ...updates,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.projects
        SET project_name = $1, project_type = $2, description = $3, priority = $4,
            funding_source = $5, budget_amount = $6, approved_budget = $7, contracted_amount = $8,
            actual_cost = $9, planned_start_date = $10, planned_end_date = $11, actual_start_date = $12,
            actual_end_date = $13, location = $14, location_description = $15, latitude = $16, longitude = $17,
            geom = ST_SetSRID(ST_MakePoint($22, $23), 4326),
            tender_id = $18, contract_id = $19, updated_by = $20, updated_at = NOW()
        WHERE id = $21
      `, [
        updated.project_name || updated.projectName,
        updated.project_type || updated.projectType,
        updated.description,
        updated.priority,
        updated.funding_source || updated.fundingSource,
        parseFloat(updated.budget_amount || updated.budgetAmount || 0),
        parseFloat(updated.approved_budget || updated.approvedBudget || 0),
        parseFloat(updated.contracted_amount || updated.contractedAmount || 0),
        parseFloat(updated.actual_cost || updated.actualCost || 0),
        updated.planned_start_date || updated.plannedStartDate,
        updated.planned_end_date || updated.plannedEndDate,
        updated.actual_start_date || updated.actualStartDate,
        updated.actual_end_date || updated.actualEndDate,
        updated.location,
        updated.location_description || updated.locationDescription,
        parseFloat(updated.latitude || 32.2980),
        parseFloat(updated.longitude || 35.7920),
        updated.tender_id || updated.tenderId || null,
        updated.contract_id || updated.contractId || null,
        user?.id || 'SYSTEM',
        actualId,
        parseFloat(updated.longitude || 35.7920),
        parseFloat(updated.latitude || 32.2980)
      ]);
    } else {
      const idx = (memDb.projects || []).findIndex(p => p.id === actualId);
      if (idx !== -1) {
        memDb.projects[idx] = updated;
        saveMemTable('projects');
      }
    }

    await this._recordAudit(user?.id, actualId, 'PROJECT_EDITED', existing, updated);
    return updated;
  }

  /**
   * تنفيذ انتقال في دورة حياة المشروع مع التحقق الصارم من SoD
   */
  async transitionStatus(projectId, targetStatus, user = null, remarks = '') {
    const existing = await this.getProjectById(projectId);
    if (!existing) {
      throw new Error(`المشروع [${projectId}] غير موجود.`);
    }

    const actualId = existing.id;
    const currentStatus = existing.status || 'DRAFT';
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      throw new Error(`انتقال غير مسموح به في دورة الحياة: لا يمكن الانتقال من [${currentStatus}] إلى [${targetStatus}].`);
    }

    // فحص حوكمة فصل المهام (SoD) لكافة الحالات الحساسة
    if (['APPROVED', 'CLOSED', 'CANCELLED'].includes(targetStatus)) {
      if (!user || !user.id) {
        throw new Error('عملية غير مصرح بها: تتطلب الموافقة أو الإغلاق أو الإلغاء جلسة مستخدم معتمدة.');
      }
      const creatorId = existing.created_by || existing.createdBy;
      if (creatorId && String(creatorId) === String(user.id) && user.role !== 'admin') {
        throw new Error(`فصل المهام والمسؤوليات: لا يجوز لمنشئ مسودة المشروع اتخاذ قرار [${targetStatus}] عليه.`);
      }
    }

    const updates = { 
      status: targetStatus, 
      updated_by: user?.id || 'SYSTEM', 
      updated_at: new Date().toISOString() 
    };

    if (targetStatus === 'IN_PROGRESS' && !existing.actual_start_date) {
      updates.actual_start_date = new Date().toISOString().split('T')[0];
    }
    if (targetStatus === 'COMPLETED' && !existing.actual_end_date) {
      updates.actual_end_date = new Date().toISOString().split('T')[0];
      updates.completion_percentage = 100.00;
      updates.physical_progress = 100.00;
    }

    if (isPostgresActive()) {
      await dbRun(
        'UPDATE public.projects SET status = $1, actual_start_date = COALESCE(actual_start_date, $2), actual_end_date = COALESCE(actual_end_date, $3), updated_at = NOW(), updated_by = $4 WHERE id = $5',
        [targetStatus, updates.actual_start_date || null, updates.actual_end_date || null, user?.id || 'SYSTEM', actualId]
      );
    } else {
      const idx = (memDb.projects || []).findIndex(p => p.id === actualId);
      if (idx !== -1) {
        memDb.projects[idx] = { ...memDb.projects[idx], ...updates };
        saveMemTable('projects');
      }
    }

    await this._recordAudit(user?.id, actualId, `PROJECT_STATUS_${targetStatus}`, { status: currentStatus }, { status: targetStatus, remarks });
    return { success: true, projectId: actualId, previousStatus: currentStatus, currentStatus: targetStatus, remarks };
  }

  /**
   * إضافة مرحلة/معلم للمشروع وإعادة احتساب الإنجاز
   */
  async addMilestone(projectId, milestoneData, user = null) {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);
    const actualId = project.id;
    const milestoneId = milestoneData.id || (await numberingEngine.generateNextId('milestones'));
    const record = {
      id: milestoneId,
      project_id: actualId,
      name: milestoneData.name || 'معلم مرحلي',
      description: milestoneData.description || '',
      planned_date: milestoneData.plannedDate || milestoneData.planned_date || new Date().toISOString().split('T')[0],
      actual_date: milestoneData.actualDate || null,
      status: milestoneData.status || 'PENDING',
      weight: parseFloat(milestoneData.weight || 10.0),
      completion_percentage: parseFloat(milestoneData.completionPercentage || 0.0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_milestones (id, project_id, name, description, planned_date, actual_date, status, weight, completion_percentage, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [record.id, record.project_id, record.name, record.description, record.planned_date, record.actual_date, record.status, record.weight, record.completion_percentage]);
    } else {
      if (!memDb.project_milestones) memDb.project_milestones = [];
      memDb.project_milestones.push(record);
      saveMemTable('project_milestones');
    }

    await this.recalculateProjectProgress(actualId);
    await this._recordAudit(user?.id, actualId, 'MILESTONE_ADDED', null, record);
    return record;
  }

  /**
   * إعادة حساب نسبة الإنجاز الفعلي بناءً على أوزان المعالم بدقة
   */
  async recalculateProjectProgress(projectId) {
    const project = await this.getProjectById(projectId);
    if (!project) return 0;
    const actualId = project.id;

    let milestones = [];
    if (isPostgresActive()) {
      milestones = await dbQuery('SELECT weight, completion_percentage FROM public.project_milestones WHERE project_id = $1', [actualId]);
    } else {
      milestones = (memDb.project_milestones || []).filter(m => m.projectId === actualId || m.project_id === actualId);
    }

    if (!milestones || milestones.length === 0) return 0;

    let totalWeight = 0;
    let weightedProgress = 0;

    milestones.forEach(m => {
      const w = parseFloat(m.weight || 1);
      const c = parseFloat(m.completion_percentage || 0);
      totalWeight += w;
      weightedProgress += (w * c);
    });

    const finalPct = totalWeight > 0 ? Math.round((weightedProgress / totalWeight) * 100) / 100 : 0;

    if (isPostgresActive()) {
      await dbRun('UPDATE public.projects SET completion_percentage = $1, physical_progress = $1, updated_at = NOW() WHERE id = $2', [finalPct, actualId]);
    } else {
      const idx = (memDb.projects || []).findIndex(p => p.id === actualId);
      if (idx !== -1) {
        memDb.projects[idx].completion_percentage = finalPct;
        memDb.projects[idx].physical_progress = finalPct;
        saveMemTable('projects');
      }
    }

    return finalPct;
  }

  /**
   * تسجيل مخاطر المشروع
   */
  async addRisk(projectId, riskData, user = null) {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);
    const actualId = project.id;
    const riskId = riskData.id || (await numberingEngine.generateNextId('risks'));
    const record = {
      id: riskId,
      project_id: actualId,
      risk_type: riskData.riskType || 'TECHNICAL',
      description: riskData.description || 'مخاطر فنية / موقعية',
      probability: riskData.probability || 'MEDIUM',
      impact: riskData.impact || 'MEDIUM',
      severity: riskData.severity || 'MEDIUM',
      mitigation: riskData.mitigation || '',
      owner: riskData.owner || 'مدير المشروع',
      status: riskData.status || 'OPEN',
      due_date: riskData.dueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_risks (id, project_id, risk_type, description, probability, impact, severity, mitigation, owner, status, due_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [record.id, record.project_id, record.risk_type, record.description, record.probability, record.impact, record.severity, record.mitigation, record.owner, record.status, record.due_date]);
    } else {
      if (!memDb.project_risks) memDb.project_risks = [];
      memDb.project_risks.push(record);
      saveMemTable('project_risks');
    }

    await this._recordAudit(user?.id, actualId, 'RISK_REGISTERED', null, record);
    return record;
  }

  /**
   * تسجيل تقرير تقدم وتحديث نسب الإنجاز
   */
  async addProgressLog(projectId, progressData, user = null) {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);
    const actualId = project.id;

    const logId = progressData.id || (await numberingEngine.generateNextId('progress_logs'));
    const physical = parseFloat(progressData.physicalProgress !== undefined ? progressData.physicalProgress : project.physical_progress || 0);
    const financial = parseFloat(progressData.financialProgress !== undefined ? progressData.financialProgress : project.financial_progress || 0);
    const variance = physical - financial;

    const record = {
      id: logId,
      project_id: actualId,
      reporting_period: progressData.reportingPeriod || 'تقرير دوري',
      progress_date: progressData.progressDate || new Date().toISOString().split('T')[0],
      physical_progress: physical,
      financial_progress: financial,
      variance,
      notes: progressData.notes || '',
      reported_by: user?.fullName || 'المهندس المشرف',
      created_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_progress_logs (id, project_id, reporting_period, progress_date, physical_progress, financial_progress, variance, notes, reported_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [record.id, record.project_id, record.reporting_period, record.progress_date, record.physical_progress, record.financial_progress, record.variance, record.notes, record.reported_by]);

      await dbRun('UPDATE public.projects SET physical_progress = $1, financial_progress = $2, completion_percentage = $1, updated_at = NOW() WHERE id = $3', [physical, financial, actualId]);
    } else {
      if (!memDb.project_progress_logs) memDb.project_progress_logs = [];
      memDb.project_progress_logs.unshift(record);
      saveMemTable('project_progress_logs');

      const idx = (memDb.projects || []).findIndex(p => p.id === actualId);
      if (idx !== -1) {
        memDb.projects[idx].physical_progress = physical;
        memDb.projects[idx].financial_progress = financial;
        memDb.projects[idx].completion_percentage = physical;
        saveMemTable('projects');
      }
    }

    await this._recordAudit(user?.id, actualId, 'PROGRESS_LOGGED', null, record);
    return record;
  }

  /**
   * حذف مشروع وتنظيف شامل لكافة السجلات التابعة (Full Cascade Cleanup)
   */
  async deleteProject(projectId, user = null) {
    const existing = await this.getProjectById(projectId);
    if (!existing) {
      throw new Error(`المشروع [${projectId}] غير موجود.`);
    }
    const actualId = existing.id;

    // حظر محاسبي وقانوني صارم لمنع حذف المشاريع ذات الصرف الفعلي أو العقود السارية
    if (parseFloat(existing.actual_cost || 0) > 0) {
      throw new Error(`حظر محاسبي وقانوني: لا يمكن حذف المشروع [${projectId}] لوجود تكاليف ومطالبات مالية مصروفة فعلياً (${existing.actual_cost} د.أ). يرجى أرشفة أو إغلاق المشروع بدلاً من الحذف.`);
    }
    if (existing.contract_id && existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      throw new Error(`حظر عقدي: لا يمكن حذف المشروع [${projectId}] لارتباطه بعقد تنفيذي ساري [${existing.contract_id}].`);
    }

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        // تنظيف كافة التبعيات لمنع Foreign Key Violations ذرّياً
        await client.query('DELETE FROM public.project_dependencies WHERE predecessor_project_id = $1 OR successor_project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_financial_programs WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_schedules WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_priority_scores WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_priority_results WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_portfolio_projects WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_plan_projects WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_progress_logs WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_risks WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.project_milestones WHERE project_id = $1', [actualId]);
        await client.query('DELETE FROM public.projects WHERE id = $1', [actualId]);
      });
    } else {
      const filterId = (item, field = 'project_id') => (item[field] !== actualId && item[field] !== existing.project_number);

      if (memDb.project_dependencies) {
        memDb.project_dependencies = memDb.project_dependencies.filter(d => 
          (d.predecessor_project_id !== actualId && d.predecessorProjectId !== actualId &&
           d.successor_project_id !== actualId && d.successorProjectId !== actualId)
        );
        saveMemTable('project_dependencies');
      }
      if (memDb.project_financial_programs) {
        memDb.project_financial_programs = memDb.project_financial_programs.filter(p => filterId(p));
        saveMemTable('project_financial_programs');
      }
      if (memDb.project_schedules) {
        memDb.project_schedules = memDb.project_schedules.filter(s => filterId(s));
        saveMemTable('project_schedules');
      }
      if (memDb.project_priority_scores) {
        memDb.project_priority_scores = memDb.project_priority_scores.filter(s => filterId(s));
        saveMemTable('project_priority_scores');
      }
      if (memDb.project_priority_results) {
        memDb.project_priority_results = memDb.project_priority_results.filter(r => filterId(r));
        saveMemTable('project_priority_results');
      }
      if (memDb.project_portfolio_projects) {
        memDb.project_portfolio_projects = memDb.project_portfolio_projects.filter(r => filterId(r));
        saveMemTable('project_portfolio_projects');
      }
      if (memDb.project_plan_projects) {
        memDb.project_plan_projects = memDb.project_plan_projects.filter(r => filterId(r));
        saveMemTable('project_plan_projects');
      }
      if (memDb.project_progress_logs) {
        memDb.project_progress_logs = memDb.project_progress_logs.filter(x => filterId(x));
        saveMemTable('project_progress_logs');
      }
      if (memDb.project_risks) {
        memDb.project_risks = memDb.project_risks.filter(x => filterId(x));
        saveMemTable('project_risks');
      }
      if (memDb.project_milestones) {
        memDb.project_milestones = memDb.project_milestones.filter(x => filterId(x));
        saveMemTable('project_milestones');
      }
      if (memDb.projects) {
        memDb.projects = memDb.projects.filter(p => p.id !== actualId && p.project_number !== actualId);
        saveMemTable('projects');
      }
    }

    await this._recordAudit(user?.id, actualId, 'PROJECT_DELETED', existing, null);
    return { success: true, message: 'تم حذف المشروع وكافة ارتباطاته التشغيلية بنجاح.' };
  }

  /**
   * فحص الجاهزية والمؤشرات التشغيلية
   */
  async healthCheck() {
    let totalProjects = 0;
    try {
      if (isPostgresActive()) {
        const r = await dbGet('SELECT COUNT(*) as count FROM public.projects');
        totalProjects = parseInt(r?.count || 0, 10);
      } else {
        totalProjects = (memDb.projects || []).length;
      }
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalProjects,
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

module.exports = new ProjectsEngineService();

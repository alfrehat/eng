/**
 * services/projectSchedulingEngineService.js
 * ⏱️ محرك الجدولة الزمنية وحسابات المسار الحرج للمشاريع الهندسية (PROJECT_SCHEDULING_ENGINE)
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
const projectDependencyEngineService = require('./projectDependencyEngineService');
const { logInfo, logWarn, logError } = require('./loggerService');

class ProjectSchedulingEngineService {
  constructor() {
    this.engineId = 'PROJECT_SCHEDULING_ENGINE';
    this.engineName = 'Enterprise Project Scheduling & CPM Timeline Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'cpm_calculation',
      'critical_path_analysis',
      'float_computation',
      'schedule_conflict_detection',
      'schedule_baselining',
      'negative_float_tracking'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الجدولة الزمنية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'الجدولة الزمنية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ProjectSchedulingEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ دوال مساعدة لحساب التواريخ والمدد (Date & Duration Utilities)
  // ═══════════════════════════════════════════════════════════════════════════

  _formatDate(dateObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  _addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this._formatDate(d);
  }

  _getDaysBetween(startDateStr, endDateStr) {
    const d1 = new Date(startDateStr);
    const d2 = new Date(endDateStr);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ خوارزمية المسار الحرج الشاملة (Critical Path Method — CPM)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب شبكة المسار الحرج مع استبعاد المشاريع الملغاة ورصد الطفو السلبي بدقة
   */
  async calculateNetworkCPM(filters = {}, user = null) {
    let rawProjects = await projectsEngineService.getProjects(filters, user);
    if (!rawProjects || rawProjects.length === 0) {
      return { totalProjects: 0, criticalProjects: 0, schedules: [] };
    }

    // 1. استبعاد المشاريع الملغاة من شبكة الحسابات الزمنية
    const projects = rawProjects.filter(p => (p.status || 'DRAFT') !== 'CANCELLED');
    const dependencies = await projectDependencyEngineService.getDependencies({ status: 'ACTIVE' });
    
    const projectMap = new Map();
    const projIds = new Set();
    const todayStr = this._formatDate(new Date());

    projects.forEach(p => {
      const id = p.id;
      projIds.add(id);

      // اعتماد التاريخ الفعلي إن وجد، وإلا التخطيطي
      let pStart = this._formatDate(p.actual_start_date || p.planned_start_date || p.plannedStartDate) || todayStr;
      let pEnd = this._formatDate(p.actual_end_date || p.planned_end_date || p.plannedEndDate) || this._addDays(pStart, 30);

      let duration = this._getDaysBetween(pStart, pEnd) + 1;
      if (duration <= 0) {
        duration = 1;
        pEnd = pStart;
      }

      projectMap.set(id, {
        id,
        projectNumber: p.project_number || p.projectNumber || id,
        projectName: p.project_name || p.projectName || 'مشروع هندسي',
        status: p.status || 'DRAFT',
        plannedStartDate: pStart,
        plannedEndDate: pEnd,
        durationDays: duration,
        earlyStartDate: pStart,
        earlyFinishDate: pEnd,
        lateStartDate: pStart,
        lateFinishDate: pEnd,
        totalFloatDays: 0,
        freeFloatDays: 0,
        isCritical: false,
        predecessors: [],
        successors: []
      });
    });

    // 2. ربط الاعتماديات النشطة بين المشاريع المؤهلة فقط
    dependencies.forEach(dep => {
      const predId = dep.predecessor_project_id || dep.predecessorProjectId;
      const succId = dep.successor_project_id || dep.successorProjectId;
      const type = (dep.dependency_type || dep.dependencyType || 'FS').toUpperCase();
      const lag = parseInt(dep.lag_days || dep.lagDays || 0, 10);

      if (projectMap.has(predId) && projectMap.has(succId)) {
        projectMap.get(succId).predecessors.push({ predId, type, lag });
        projectMap.get(predId).successors.push({ succId, type, lag });
      }
    });

    // 3. الترتيب الطوبولوجي المنيع (Kahn's Algorithm)
    const inDegree = new Map();
    projIds.forEach(id => inDegree.set(id, projectMap.get(id).predecessors.length));

    const queue = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const topoOrder = [];
    while (queue.length > 0) {
      const u = queue.shift();
      topoOrder.push(u);

      const succs = projectMap.get(u).successors;
      for (const edge of succs) {
        const v = edge.succId;
        const currentDeg = inDegree.get(v) - 1;
        inDegree.set(v, currentDeg);
        if (currentDeg === 0) queue.push(v);
      }
    }

    // إدراج المشاريع المنفصلة غير المرتبطة بحلقات
    projIds.forEach(id => {
      if (!topoOrder.includes(id)) topoOrder.push(id);
    });

    // 4. التمرير الأمامي (Forward Pass)
    for (const id of topoOrder) {
      const node = projectMap.get(id);
      let calculatedES = node.plannedStartDate;

      for (const predEdge of node.predecessors) {
        const predNode = projectMap.get(predEdge.predId);
        if (!predNode) continue;

        let constraintDate = null;
        switch (predEdge.type) {
          case 'FS':
            constraintDate = this._addDays(predNode.earlyFinishDate, predEdge.lag + 1);
            break;
          case 'SS':
            constraintDate = this._addDays(predNode.earlyStartDate, predEdge.lag);
            break;
          case 'FF':
            constraintDate = this._addDays(predNode.earlyFinishDate, predEdge.lag - node.durationDays + 1);
            break;
          case 'SF':
            constraintDate = this._addDays(predNode.earlyStartDate, predEdge.lag - node.durationDays + 1);
            break;
        }

        if (constraintDate && new Date(constraintDate) > new Date(calculatedES)) {
          calculatedES = constraintDate;
        }
      }

      node.earlyStartDate = calculatedES;
      node.earlyFinishDate = this._addDays(calculatedES, node.durationDays - 1);
    }

    // 5. التمرير العكسي (Backward Pass)
    let networkMaxFinish = todayStr;
    projectMap.forEach(node => {
      if (new Date(node.earlyFinishDate) > new Date(networkMaxFinish)) {
        networkMaxFinish = node.earlyFinishDate;
      }
    });

    const reverseTopo = [...topoOrder].reverse();
    for (const id of reverseTopo) {
      const node = projectMap.get(id);

      if (node.successors.length === 0) {
        node.lateFinishDate = networkMaxFinish;
        node.lateStartDate = this._addDays(node.lateFinishDate, -(node.durationDays - 1));
      } else {
        let calculatedLF = null;

        for (const succEdge of node.successors) {
          const succNode = projectMap.get(succEdge.succId);
          if (!succNode) continue;

          let constraintDate = null;
          switch (succEdge.type) {
            case 'FS':
              constraintDate = this._addDays(succNode.lateStartDate, -(succEdge.lag + 1));
              break;
            case 'SS':
              constraintDate = this._addDays(succNode.lateStartDate, -succEdge.lag + node.durationDays - 1);
              break;
            case 'FF':
              constraintDate = this._addDays(succNode.lateFinishDate, -succEdge.lag);
              break;
            case 'SF':
              constraintDate = this._addDays(succNode.lateFinishDate, -succEdge.lag + node.durationDays - 1);
              break;
          }

          if (constraintDate) {
            if (!calculatedLF || new Date(constraintDate) < new Date(calculatedLF)) {
              calculatedLF = constraintDate;
            }
          }
        }

        node.lateFinishDate = calculatedLF || networkMaxFinish;
        node.lateStartDate = this._addDays(node.lateFinishDate, -(node.durationDays - 1));
      }

      // 6. احتساب الطفو الزمني الكلي بدقة متناهية (رصد الطفو السالب للتأخيرات)
      node.totalFloatDays = this._getDaysBetween(node.earlyStartDate, node.lateStartDate);
      node.isCritical = node.totalFloatDays <= 0;

      // 7. احتساب الطفو الحر (Free Float) الشامل لكافة العلاقات الأربع
      let minFreeFloat = node.totalFloatDays;
      if (node.successors.length > 0) {
        for (const succEdge of node.successors) {
          const succNode = projectMap.get(succEdge.succId);
          if (!succNode) continue;

          let gap = node.totalFloatDays;
          switch (succEdge.type) {
            case 'FS':
              gap = this._getDaysBetween(node.earlyFinishDate, succNode.earlyStartDate) - (succEdge.lag + 1);
              break;
            case 'SS':
              gap = this._getDaysBetween(node.earlyStartDate, succNode.earlyStartDate) - succEdge.lag;
              break;
            case 'FF':
              gap = this._getDaysBetween(node.earlyFinishDate, succNode.earlyFinishDate) - succEdge.lag;
              break;
            case 'SF':
              gap = this._getDaysBetween(node.earlyStartDate, succNode.earlyFinishDate) - succEdge.lag;
              break;
          }

          if (gap < minFreeFloat) minFreeFloat = gap;
        }
      }
      node.freeFloatDays = minFreeFloat;
    }

    // 8. حفظ النتائج في جدول project_schedules
    const schedulesList = [];
    for (const [pId, node] of projectMap.entries()) {
      const scheduleId = `SCH-${pId}-${Date.now().toString(36)}`;
      const record = {
        id: scheduleId,
        project_id: pId,
        planned_start_date: node.plannedStartDate,
        planned_end_date: node.plannedEndDate,
        duration_days: node.durationDays,
        early_start_date: node.earlyStartDate,
        early_finish_date: node.earlyFinishDate,
        late_start_date: node.lateStartDate,
        late_finish_date: node.lateFinishDate,
        total_float_days: node.totalFloatDays,
        free_float_days: node.freeFloatDays,
        is_critical: node.isCritical,
        is_baseline: false,
        schedule_version: 'v1.0',
        status: 'ACTIVE',
        notes: `تم احتساب الجدولة والمسار الحرج بتاريخ ${todayStr}`,
        calculated_at: new Date().toISOString(),
        calculated_by: user?.id || 'SYSTEM'
      };

      if (isPostgresActive()) {
        await dbRun(`
          INSERT INTO public.project_schedules
          (id, project_id, planned_start_date, planned_end_date, duration_days, early_start_date, early_finish_date,
           late_start_date, late_finish_date, total_float_days, free_float_days, is_critical, is_baseline, schedule_version, status, notes, calculated_at, calculated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (project_id, schedule_version) DO UPDATE
          SET planned_start_date = EXCLUDED.planned_start_date, planned_end_date = EXCLUDED.planned_end_date,
              duration_days = EXCLUDED.duration_days, early_start_date = EXCLUDED.early_start_date,
              early_finish_date = EXCLUDED.early_finish_date, late_start_date = EXCLUDED.late_start_date,
              late_finish_date = EXCLUDED.late_finish_date, total_float_days = EXCLUDED.total_float_days,
              free_float_days = EXCLUDED.free_float_days, is_critical = EXCLUDED.is_critical,
              calculated_at = NOW(), calculated_by = EXCLUDED.calculated_by
        `, Object.values(record));
      } else {
        if (!memDb.project_schedules) memDb.project_schedules = [];
        const idx = memDb.project_schedules.findIndex(s => s.project_id === pId && s.schedule_version === 'v1.0');
        if (idx !== -1) {
          memDb.project_schedules[idx] = record;
        } else {
          memDb.project_schedules.push(record);
        }
        saveMemTable('project_schedules');
      }

      schedulesList.push({
        ...record,
        projectNumber: node.projectNumber,
        projectName: node.projectName
      });
    }

    await this._recordAudit(user?.id, 'NETWORK_CPM', 'PROJECT_SCHEDULE_CALCULATED', null, { count: schedulesList.length });

    return {
      success: true,
      totalProjects: schedulesList.length,
      criticalProjects: schedulesList.filter(s => s.is_critical).length,
      networkFinishDate: networkMaxFinish,
      schedules: schedulesList
    };
  }

  /**
   * استرجاع الجدول الزمني لمشروع محدد دون إعادة حساب عشوائية
   */
  async getProjectSchedule(projectId, version = 'v1.0') {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    let sched = null;
    if (isPostgresActive()) {
      sched = await dbGet('SELECT * FROM public.project_schedules WHERE project_id = $1 AND schedule_version = $2', [actualProjectId, version]);
    } else {
      sched = (memDb.project_schedules || []).find(s => (s.project_id === actualProjectId || s.projectId === actualProjectId) && s.schedule_version === version);
    }

    // إعادة الحساب الموجه فقط إذا كان المطلوب هو v1.0 ولم يُحسب من قبل
    if (!sched && version === 'v1.0') {
      const cpmRes = await this.calculateNetworkCPM({}, null);
      sched = (cpmRes.schedules || []).find(s => s.project_id === actualProjectId) || null;
    }

    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      schedule: sched
    };
  }

  /**
   * استرجاع مسار المشاريع الحرجة فقط (Critical Path)
   */
  async getCriticalPath(filters = {}) {
    const cpmResult = await this.calculateNetworkCPM(filters);
    const criticalList = (cpmResult.schedules || []).filter(s => s.is_critical || s.total_float_days <= 0);
    return {
      totalCritical: criticalList.length,
      networkFinishDate: cpmResult.networkFinishDate,
      criticalPath: criticalList
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ كشف التعارضات والانحرافات الميدانية (Conflict Detection)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * رصد التعارضات الزمنية بالاستناد إلى التواريخ الفعلية والتخطيطية معاً
   */
  async detectScheduleConflicts() {
    const deps = await projectDependencyEngineService.getDependencies({ status: 'ACTIVE' });
    const conflicts = [];

    for (const dep of deps) {
      const predId = dep.predecessor_project_id || dep.predecessorProjectId;
      const succId = dep.successor_project_id || dep.successorProjectId;
      const type = dep.dependency_type || dep.dependencyType || 'FS';
      const lag = parseInt(dep.lag_days || dep.lagDays || 0, 10);

      const pred = await projectsEngineService.getProjectById(predId);
      const succ = await projectsEngineService.getProjectById(succId);
      if (!pred || !succ) continue;
      if (pred.status === 'CANCELLED' || succ.status === 'CANCELLED') continue;

      const predStart = this._formatDate(pred.actual_start_date || pred.planned_start_date || pred.plannedStartDate);
      const predEnd = this._formatDate(pred.actual_end_date || pred.planned_end_date || pred.plannedEndDate);
      const succStart = this._formatDate(succ.actual_start_date || succ.planned_start_date || succ.plannedStartDate);
      const succEnd = this._formatDate(succ.actual_end_date || succ.planned_end_date || succ.plannedEndDate);

      let isViolated = false;
      let expectedDate = '';

      switch (type) {
        case 'FS':
          if (predEnd && succStart) {
            expectedDate = this._addDays(predEnd, lag + 1);
            if (new Date(succStart) < new Date(expectedDate)) isViolated = true;
          }
          break;
        case 'SS':
          if (predStart && succStart) {
            expectedDate = this._addDays(predStart, lag);
            if (new Date(succStart) < new Date(expectedDate)) isViolated = true;
          }
          break;
        case 'FF':
          if (predEnd && succEnd) {
            expectedDate = this._addDays(predEnd, lag);
            if (new Date(succEnd) < new Date(expectedDate)) isViolated = true;
          }
          break;
        case 'SF':
          if (predStart && succEnd) {
            expectedDate = this._addDays(predStart, lag);
            if (new Date(succEnd) < new Date(expectedDate)) isViolated = true;
          }
          break;
      }

      if (isViolated) {
        conflicts.push({
          dependencyId: dep.id,
          predecessorId: predId,
          predecessorNumber: pred.project_number || predId,
          successorId: succId,
          successorNumber: succ.project_number || succId,
          dependencyType: type,
          lagDays: lag,
          expectedEarliestDate: expectedDate,
          conflictReason: `تعارض زمني: المشروع اللاحق يبدأ/ينتهي في تاريخ ينتهك العلاقة (${type}+${lag}) مع المشروع السابق`
        });
      }
    }

    return {
      conflictsCount: conflicts.length,
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4️⃣ إدارة الخطوط المرجعية التراكمية (Schedule Baselines & Versioning)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء خط مرجعي جديد مع حفظ تاريخ النسخ السابقة (Versioning)
   */
  async createScheduleBaseline(projectId, user = null) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const currentSched = await this.getProjectSchedule(actualProjectId, 'v1.0');
    if (!currentSched || !currentSched.schedule) {
      throw new Error('لا يوجد جدول زمني محسوب لهذا المشروع لتثبيت خط الأساس.');
    }

    // استخراج رقم النسخة المرجعية التالية
    let nextVersion = 'BASELINE_1';
    if (isPostgresActive()) {
      const res = await dbGet("SELECT COUNT(*) as count FROM public.project_schedules WHERE project_id = $1 AND is_baseline = true", [actualProjectId]);
      const count = parseInt(res?.count || 0, 10);
      nextVersion = `BASELINE_${count + 1}`;
    } else {
      const count = (memDb.project_schedules || []).filter(s => s.project_id === actualProjectId && s.is_baseline).length;
      nextVersion = `BASELINE_${count + 1}`;
    }

    const baselineId = `BSL-${actualProjectId}-${Date.now().toString(36)}`;
    const baselineRecord = {
      id: baselineId,
      project_id: actualProjectId,
      planned_start_date: currentSched.schedule.planned_start_date,
      planned_end_date: currentSched.schedule.planned_end_date,
      duration_days: currentSched.schedule.duration_days,
      early_start_date: currentSched.schedule.early_start_date,
      early_finish_date: currentSched.schedule.early_finish_date,
      late_start_date: currentSched.schedule.late_start_date,
      late_finish_date: currentSched.schedule.late_finish_date,
      total_float_days: currentSched.schedule.total_float_days,
      free_float_days: currentSched.schedule.free_float_days,
      is_critical: currentSched.schedule.is_critical,
      is_baseline: true,
      schedule_version: nextVersion,
      status: 'APPROVED',
      notes: `تم تثبيت الخط المرجعي (${nextVersion}) بواسطة ${user?.fullName || user?.username || 'مدير النظام'}`,
      calculated_at: new Date().toISOString(),
      calculated_by: user?.id || 'SYSTEM'
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_schedules
        (id, project_id, planned_start_date, planned_end_date, duration_days, early_start_date, early_finish_date,
         late_start_date, late_finish_date, total_float_days, free_float_days, is_critical, is_baseline, schedule_version, status, notes, calculated_at, calculated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, Object.values(baselineRecord));
    } else {
      if (!memDb.project_schedules) memDb.project_schedules = [];
      memDb.project_schedules.push(baselineRecord);
      saveMemTable('project_schedules');
    }

    await this._recordAudit(user?.id, actualProjectId, 'PROJECT_SCHEDULE_BASELINED', null, baselineRecord);
    return {
      success: true,
      message: `تم تثبيت الخط المرجعي (${nextVersion}) بنجاح.`,
      baseline: baselineRecord
    };
  }

  /**
   * استرجاع آخر خط مرجعي معتمد للمشروع
   */
  async getScheduleBaseline(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    let baseline = null;
    if (isPostgresActive()) {
      baseline = await dbGet(
        'SELECT * FROM public.project_schedules WHERE project_id = $1 AND is_baseline = true ORDER BY calculated_at DESC LIMIT 1',
        [actualProjectId]
      );
    } else {
      const list = (memDb.project_schedules || []).filter(s => (s.project_id === actualProjectId || s.projectId === actualProjectId) && s.is_baseline);
      baseline = list.length > 0 ? list[list.length - 1] : null;
    }

    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      baseline
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalSchedules = 0;
    let criticalCount = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_critical = true) as critical FROM public.project_schedules WHERE schedule_version = 'v1.0'");
        totalSchedules = parseInt(res?.total || 0, 10);
        criticalCount = parseInt(res?.critical || 0, 10);
      } else {
        const all = (memDb.project_schedules || []).filter(s => s.schedule_version === 'v1.0');
        totalSchedules = all.length;
        criticalCount = all.filter(s => s.is_critical).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalSchedules,
        criticalCount,
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

module.exports = new ProjectSchedulingEngineService();

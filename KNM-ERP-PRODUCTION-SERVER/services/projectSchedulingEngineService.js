/**
 * services/projectSchedulingEngineService.js
 * ⏱️ محرك الجدولة الزمنية وحسابات المسار الحرج للمشاريع الهندسية (PROJECT_SCHEDULING_ENGINE — Phase 04-E)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. حسابات المسار الحرج المعيارية (CPM): Forward Pass (ES, EF) و Backward Pass (LS, LF).
 * 2. احتساب الطفو الزمني الكلي والحر (Total Float & Free Float) وتحديد الأنشطة والمشاريع الحرجة (Critical Path).
 * 3. دعم علاقات الأسبقية الأربعة (FS, SS, FF, SF مع lag_days) زمنياً وتقويمياً.
 * 4. رصد وكشف التعارضات والانحرافات الزمنية (Schedule Conflict Detection).
 * 5. إدارة واعتماد الخطوط المرجعية للجدول الزمني (Schedule Baselines & Versioning).
 * 6. العزل التام لبيانات الجدولة في جدول مستقل دون تشويه بيانات المشاريع الأساسية أو المالية.
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
    this.version = '1.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'cpm_calculation',
      'critical_path_analysis',
      'float_computation',
      'schedule_conflict_detection',
      'schedule_baselining'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الجدولة الزمنية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'الجدولة الزمنية والمسار الحرج', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-SCHED-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'الجدولة الزمنية والمسار الحرج',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('ProjectSchedulingEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ دوال مساعدة لحساب التواريخ والمدد (Date & Duration Utilities)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * تنسيق التاريخ إلى YYYY-MM-DD
   */
  _formatDate(dateObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  /**
   * إضافة عدد أيام إلى تاريخ معين
   */
  _addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this._formatDate(d);
  }

  /**
   * حساب الفرق بالأيام بين تاريخين شامل اليوم الأول
   */
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
   * احتساب شبكة المسار الحرج والتواريخ المبكرة والمتأخرة لشبكة المشاريع
   */
  async calculateNetworkCPM(filters = {}, user = null) {
    // 1. جلب قائمة المشاريع والاعتماديات
    let projects = await projectsEngineService.getProjects(filters, user);
    if (!projects || projects.length === 0) {
      return { totalProjects: 0, criticalProjects: 0, schedules: [] };
    }

    const dependencies = await projectDependencyEngineService.getDependencies({ status: 'ACTIVE' });
    const projectMap = new Map();
    const projIds = new Set();

    const todayStr = this._formatDate(new Date());

    projects.forEach(p => {
      const id = p.id;
      projIds.add(id);

      // استخراج تواريخ البداية والنهاية أو وضع افتراضات منطقية
      let pStart = this._formatDate(p.planned_start_date || p.plannedStartDate);
      let pEnd = this._formatDate(p.planned_end_date || p.plannedEndDate);

      if (!pStart) pStart = todayStr;
      if (!pEnd) pEnd = this._addDays(pStart, 30); // مدة افتراضية 30 يوماً إن لم تحدد

      let duration = this._getDaysBetween(pStart, pEnd) + 1;
      if (duration <= 0) {
        duration = 1;
        pEnd = pStart;
      }

      projectMap.set(id, {
        id,
        projectNumber: p.project_number || p.projectNumber || id,
        projectName: p.project_name || p.projectName || 'مشروع هندسي',
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

    // 2. ربط الاعتماديات في الذاكرة
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

    // 3. الترتيب الطوبولوجي (Topological Sort — Kahn's Algorithm)
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

    // للمشاريع غير المرتبطة بحلقات، إذا تبقى مشاريع نضيفها
    projIds.forEach(id => {
      if (!topoOrder.includes(id)) topoOrder.push(id);
    });

    // 4. التمرير الأمامي (Forward Pass) لحساب Early Start (ES) و Early Finish (EF)
    for (const id of topoOrder) {
      const node = projectMap.get(id);
      let calculatedES = node.plannedStartDate;

      for (const predEdge of node.predecessors) {
        const predNode = projectMap.get(predEdge.predId);
        if (!predNode) continue;

        let constraintDate = null;
        switch (predEdge.type) {
          case 'FS': // Finish-to-Start: ES >= EF(pred) + lag + 1
            constraintDate = this._addDays(predNode.earlyFinishDate, predEdge.lag + 1);
            break;
          case 'SS': // Start-to-Start: ES >= ES(pred) + lag
            constraintDate = this._addDays(predNode.earlyStartDate, predEdge.lag);
            break;
          case 'FF': // Finish-to-Finish: EF >= EF(pred) + lag => ES >= EF(pred) + lag - duration + 1
            constraintDate = this._addDays(predNode.earlyFinishDate, predEdge.lag - node.durationDays + 1);
            break;
          case 'SF': // Start-to-Finish: EF >= ES(pred) + lag => ES >= ES(pred) + lag - duration + 1
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

    // 5. التمرير الخلفي (Backward Pass) لحساب Late Start (LS) و Late Finish (LF)
    // تحديد تاريخ نهاية الشبكة الإجمالي
    let networkMaxFinish = todayStr;
    projectMap.forEach(node => {
      if (new Date(node.earlyFinishDate) > new Date(networkMaxFinish)) {
        networkMaxFinish = node.earlyFinishDate;
      }
    });

    // التمرير العكسي
    const reverseTopo = [...topoOrder].reverse();
    for (const id of reverseTopo) {
      const node = projectMap.get(id);

      if (node.successors.length === 0) {
        // عقدة نهاية (Finish Node)
        node.lateFinishDate = networkMaxFinish;
        node.lateStartDate = this._addDays(node.lateFinishDate, -(node.durationDays - 1));
      } else {
        let calculatedLF = null;

        for (const succEdge of node.successors) {
          const succNode = projectMap.get(succEdge.succId);
          if (!succNode) continue;

          let constraintDate = null;
          switch (succEdge.type) {
            case 'FS': // LF(pred) <= LS(succ) - lag - 1
              constraintDate = this._addDays(succNode.lateStartDate, -(succEdge.lag + 1));
              break;
            case 'SS': // LS(pred) <= LS(succ) - lag => LF(pred) <= LS(succ) - lag + duration - 1
              constraintDate = this._addDays(succNode.lateStartDate, -succEdge.lag + node.durationDays - 1);
              break;
            case 'FF': // LF(pred) <= LF(succ) - lag
              constraintDate = this._addDays(succNode.lateFinishDate, -succEdge.lag);
              break;
            case 'SF': // LS(pred) <= LF(succ) - lag => LF(pred) <= LF(succ) - lag + duration - 1
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

      // 6. احتساب الطفو الزمني والمسار الحرج (Total Float & Critical Path)
      // Total Float = LS - ES (أو LF - EF)
      const floatDays = this._getDaysBetween(node.earlyStartDate, node.lateStartDate);
      node.totalFloatDays = Math.max(0, floatDays);
      node.isCritical = node.totalFloatDays === 0;

      // Free Float = min(ES(succ) - EF(pred) - lag - 1)
      let minFreeFloat = node.totalFloatDays;
      for (const succEdge of node.successors) {
        const succNode = projectMap.get(succEdge.succId);
        if (succNode && succEdge.type === 'FS') {
          const gap = this._getDaysBetween(node.earlyFinishDate, succNode.earlyStartDate) - (succEdge.lag + 1);
          if (gap < minFreeFloat) minFreeFloat = Math.max(0, gap);
        }
      }
      node.freeFloatDays = minFreeFloat;
    }

    // 7. حفظ وتحديث النتائج في جدول project_schedules
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
        notes: `تم احتساب الجدولة والمسار الحرج بتاريخ ${new Date().toISOString().split('T')[0]}`,
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
          memDb.project_schedules[idx] = { ...memDb.project_schedules[idx], ...record };
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

    const criticalCount = schedulesList.filter(s => s.is_critical).length;
    return {
      success: true,
      totalProjects: schedulesList.length,
      criticalProjects: criticalCount,
      networkFinishDate: networkMaxFinish,
      schedules: schedulesList
    };
  }

  /**
   * استرجاع الجدول الزمني لمشروع محدد
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

    if (!sched) {
      // إذا لم يكن محسوباً مسبقاً، نحسبه للمشروع فوراً
      await this.calculateNetworkCPM({}, null);
      if (isPostgresActive()) {
        sched = await dbGet('SELECT * FROM public.project_schedules WHERE project_id = $1 AND schedule_version = $2', [actualProjectId, version]);
      } else {
        sched = (memDb.project_schedules || []).find(s => (s.project_id === actualProjectId || s.projectId === actualProjectId) && s.schedule_version === version);
      }
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
    const criticalList = (cpmResult.schedules || []).filter(s => s.is_critical || s.total_float_days === 0);
    return {
      totalCritical: criticalList.length,
      networkFinishDate: cpmResult.networkFinishDate,
      criticalPath: criticalList
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ كشف التعارضات والانحرافات الزمنية (Conflict Detection)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * رصد التعارضات الزمنية التي تنتهك علاقات الأسبقية
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

      const predStart = this._formatDate(pred.planned_start_date || pred.plannedStartDate);
      const predEnd = this._formatDate(pred.planned_end_date || pred.plannedEndDate);
      const succStart = this._formatDate(succ.planned_start_date || succ.plannedStartDate);
      const succEnd = this._formatDate(succ.planned_end_date || succ.plannedEndDate);

      if (!predEnd || !succStart) continue;

      let isViolated = false;
      let expectedDate = '';

      switch (type) {
        case 'FS':
          expectedDate = this._addDays(predEnd, lag + 1);
          if (new Date(succStart) < new Date(expectedDate)) {
            isViolated = true;
          }
          break;
        case 'SS':
          expectedDate = this._addDays(predStart, lag);
          if (new Date(succStart) < new Date(expectedDate)) {
            isViolated = true;
          }
          break;
        case 'FF':
          expectedDate = this._addDays(predEnd, lag);
          if (succEnd && new Date(succEnd) < new Date(expectedDate)) {
            isViolated = true;
          }
          break;
        case 'SF':
          expectedDate = this._addDays(predStart, lag);
          if (succEnd && new Date(succEnd) < new Date(expectedDate)) {
            isViolated = true;
          }
          break;
      }

      if (isViolated) {
        conflicts.push({
          dependencyId: dep.id,
          predecessorId: predId,
          predecessorNumber: pred.project_number || predId,
          predecessorEndDate: predEnd,
          successorId: succId,
          successorNumber: succ.project_number || succId,
          successorStartDate: succStart,
          dependencyType: type,
          lagDays: lag,
          expectedEarliestDate: expectedDate,
          conflictReason: `المشروع اللاحق مخطط للبدء في (${succStart}) وهو أسبق من الحد الأدنى المسموح به بعد انتهاء المشروع السابق (${expectedDate})`
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
  // 4️⃣ إدارة الخطوط المرجعية (Schedule Baselines)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء واعتماد خط مرجعي للجدول الزمني (Schedule Baseline)
   */
  async createScheduleBaseline(projectId, user = null) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const currentSched = await this.getProjectSchedule(actualProjectId, 'v1.0');
    if (!currentSched || !currentSched.schedule) {
      throw new Error('لا يوجد جدول زمني محسوب لهذا المشروع.');
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
      schedule_version: 'BASELINE',
      status: 'APPROVED',
      notes: `تم تثبيت الخط المرجعي للجدول الزمني بواسطة ${user?.username || 'مدير النظام'}`,
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
      `, Object.values(baselineRecord));
    } else {
      if (!memDb.project_schedules) memDb.project_schedules = [];
      const idx = memDb.project_schedules.findIndex(s => s.project_id === actualProjectId && s.schedule_version === 'BASELINE');
      if (idx !== -1) {
        memDb.project_schedules[idx] = baselineRecord;
      } else {
        memDb.project_schedules.push(baselineRecord);
      }
      saveMemTable('project_schedules');
    }

    await this._recordAudit(user?.id, actualProjectId, 'PROJECT_SCHEDULE_BASELINED', null, baselineRecord);
    return {
      success: true,
      message: 'تم تثبيت الخط المرجعي للجدول الزمني بنجاح.',
      baseline: baselineRecord
    };
  }

  /**
   * استرجاع الخط المرجعي للمشروع
   */
  async getScheduleBaseline(projectId) {
    return await this.getProjectSchedule(projectId, 'BASELINE');
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

const projectSchedulingEngineService = new ProjectSchedulingEngineService();
module.exports = projectSchedulingEngineService;

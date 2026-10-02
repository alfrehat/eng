/**
 * services/projectDependencyEngineService.js
 * 🔗 محرك شبكة واعتماديات تتابع المشاريع الهندسية (PROJECT_DEPENDENCY_ENGINE)
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
const { logInfo, logWarn, logError } = require('./loggerService');

class ProjectDependencyEngineService {
  constructor() {
    this.engineId = 'PROJECT_DEPENDENCY_ENGINE';
    this.engineName = 'Enterprise Project Dependency & Precedence Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'dependency_network',
      'cycle_detection',
      'readiness_validation',
      'dependency_graph',
      'cascade_validation'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء اعتماديات المشاريع [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'اعتماديات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ProjectDependencyEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ كشف التبعيات الدائرية (Cycle Detection Algorithm)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * فحص وجود حلقة مغلقة في شبكة التتابع مع حل المعرفات المسبق
   */
  async detectCycle(fromProjectId, toProjectId, excludeDependencyId = null) {
    const p1 = await projectsEngineService.getProjectById(fromProjectId);
    const p2 = await projectsEngineService.getProjectById(toProjectId);

    const actualFrom = p1 ? p1.id : fromProjectId;
    const actualTo = p2 ? p2.id : toProjectId;

    if (actualFrom === actualTo) {
      return {
        hasCycle: true,
        cyclePath: [p1?.project_number || actualFrom, p2?.project_number || actualTo]
      };
    }

    // جلب كافة العلاقات النشطة
    let allDeps = [];
    if (isPostgresActive()) {
      allDeps = await dbQuery("SELECT id, predecessor_project_id, successor_project_id FROM public.project_dependencies WHERE status = 'ACTIVE'") || [];
    } else {
      allDeps = (memDb.project_dependencies || []).filter(d => d.status === 'ACTIVE');
    }

    // بناء قائمة المجاورة (Adjacency List)
    const adj = new Map();
    for (const d of allDeps) {
      if (excludeDependencyId && d.id === excludeDependencyId) continue;
      const u = d.predecessor_project_id || d.predecessorProjectId;
      const v = d.successor_project_id || d.successorProjectId;
      if (!adj.has(u)) adj.set(u, []);
      adj.get(u).push(v);
    }

    // البحث في العمق (DFS) للتأكد من عدم وجود مسار يعود من actualTo إلى actualFrom
    const visited = new Set();
    const path = [];

    const dfs = (curr, target) => {
      visited.add(curr);
      path.push(curr);

      if (curr === target) {
        return true;
      }

      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          if (dfs(next, target)) return true;
        }
      }

      path.pop();
      return false;
    };

    const hasPathBack = dfs(actualTo, actualFrom);
    if (hasPathBack) {
      const fullPathIds = [actualFrom, ...path];
      // استبدال المعرفات بأرقام المشاريع لتحسين المقروئية
      const fullPathNames = [];
      for (const id of fullPathIds) {
        const prj = await projectsEngineService.getProjectById(id);
        fullPathNames.push(prj?.project_number || id);
      }

      return {
        hasCycle: true,
        cyclePath: fullPathNames
      };
    }

    return {
      hasCycle: false,
      cyclePath: null
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة علاقات الأسبقية (Dependency Management)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء علاقة اعتمادية وأسبقية جديدة بين مشروعين
   */
  async createDependency(data, user = null) {
    const rawPredId = data.predecessorProjectId || data.predecessor_project_id;
    const rawSuccId = data.successorProjectId || data.successor_project_id;
    const dependencyType = (data.dependencyType || data.dependency_type || 'FS').toUpperCase();
    const lagDays = Math.max(0, parseInt(data.lagDays !== undefined ? data.lagDays : (data.lag_days || 0), 10));

    if (!rawPredId) throw new Error('معرف المشروع السابق (predecessorProjectId) حقل إلزامي.');
    if (!rawSuccId) throw new Error('معرف المشروع اللاحق (successorProjectId) حقل إلزامي.');

    const validTypes = ['FS', 'SS', 'FF', 'SF'];
    if (!validTypes.includes(dependencyType)) {
      throw new Error(`نوع العلاقة [${dependencyType}] غير صالح. الأنواع المعتمدة هي: ${validTypes.join(', ')}.`);
    }

    // التحقق من وجود كلا المشروعين وحل المعرفات الحقيقية
    const predProject = await projectsEngineService.getProjectById(rawPredId);
    if (!predProject) throw new Error(`المشروع السابق (Predecessor) [${rawPredId}] غير موجود.`);

    const succProject = await projectsEngineService.getProjectById(rawSuccId);
    if (!succProject) throw new Error(`المشروع اللاحق (Successor) [${rawSuccId}] غير موجود.`);

    const actualPredId = predProject.id;
    const actualSuccId = succProject.id;

    if (actualPredId === actualSuccId) {
      throw new Error('لا يمكن للمشروع أن يعتمد على نفسه (Self-Dependency is strictly forbidden).');
    }

    // فحص منع تكرار العلاقة النشطة فقط
    let duplicate = null;
    if (isPostgresActive()) {
      duplicate = await dbGet(
        "SELECT id FROM public.project_dependencies WHERE predecessor_project_id = $1 AND successor_project_id = $2 AND status = 'ACTIVE'",
        [actualPredId, actualSuccId]
      );
    } else {
      duplicate = (memDb.project_dependencies || []).find(d => 
        (d.predecessor_project_id === actualPredId || d.predecessorProjectId === actualPredId) &&
        (d.successor_project_id === actualSuccId || d.successorProjectId === actualSuccId) &&
        d.status === 'ACTIVE'
      );
    }
    if (duplicate) {
      throw new Error(`توجد علاقة اعتمادية نشطة مسبقاً بين المشروع السابق [${predProject.project_number || actualPredId}] واللاحق [${succProject.project_number || actualSuccId}].`);
    }

    // فحص ومنع التبعيات الدائرية
    const cycleCheck = await this.detectCycle(actualPredId, actualSuccId);
    if (cycleCheck.hasCycle) {
      const pathDisplay = cycleCheck.cyclePath.join(' ➔ ');
      throw new Error(`⛔ تم اكتشاف اعتمادية دائرية مغلقة (Circular Dependency Detected): [${pathDisplay}]. لا يمكن حفظ العلاقة.`);
    }

    const dependencyId = data.id || `DEP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const record = {
      id: dependencyId,
      predecessor_project_id: actualPredId,
      successor_project_id: actualSuccId,
      dependency_type: dependencyType,
      lag_days: lagDays,
      description: data.description || '',
      notes: data.notes || '',
      status: data.status || 'ACTIVE',
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_by: user?.id || 'SYSTEM',
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_dependencies
        (id, predecessor_project_id, successor_project_id, dependency_type, lag_days, description, notes, status, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, Object.values(record));
    } else {
      if (!memDb.project_dependencies) memDb.project_dependencies = [];
      memDb.project_dependencies.push(record);
      saveMemTable('project_dependencies');
    }

    await this._recordAudit(user?.id, dependencyId, 'PROJECT_DEPENDENCY_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع قائمة الاعتماديات مع حل المعرفات الذكي
   */
  async getDependencies(filters = {}) {
    let resolvedPredId = filters.predecessorProjectId || filters.predecessor_project_id;
    if (resolvedPredId) {
      const p = await projectsEngineService.getProjectById(resolvedPredId);
      if (p) resolvedPredId = p.id;
    }

    let resolvedSuccId = filters.successorProjectId || filters.successor_project_id;
    if (resolvedSuccId) {
      const p = await projectsEngineService.getProjectById(resolvedSuccId);
      if (p) resolvedSuccId = p.id;
    }

    const depType = (filters.dependencyType || filters.dependency_type || '').toUpperCase();

    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_dependencies WHERE 1=1';
      const params = [];
      if (resolvedPredId) {
        params.push(resolvedPredId);
        q += ` AND predecessor_project_id = $${params.length}`;
      }
      if (resolvedSuccId) {
        params.push(resolvedSuccId);
        q += ` AND successor_project_id = $${params.length}`;
      }
      if (depType) {
        params.push(depType);
        q += ` AND dependency_type = $${params.length}`;
      }
      if (filters.status) {
        params.push(filters.status);
        q += ` AND status = $${params.length}`;
      }
      q += ' ORDER BY created_at DESC';
      list = await dbQuery(q, params);
    } else {
      list = (memDb.project_dependencies || []).slice();
      if (resolvedPredId) {
        list = list.filter(d => (d.predecessor_project_id || d.predecessorProjectId) === resolvedPredId);
      }
      if (resolvedSuccId) {
        list = list.filter(d => (d.successor_project_id || d.successorProjectId) === resolvedSuccId);
      }
      if (depType) {
        list = list.filter(d => (d.dependency_type || d.dependencyType) === depType);
      }
      if (filters.status) {
        list = list.filter(d => d.status === filters.status);
      }
      list.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
    }
    return list || [];
  }

  /**
   * استرجاع سجل علاقة اعتمادية مفرد
   */
  async getDependencyById(dependencyId) {
    if (!dependencyId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.project_dependencies WHERE id = $1', [dependencyId]);
    } else {
      return (memDb.project_dependencies || []).find(d => d.id === dependencyId) || null;
    }
  }

  /**
   * تعديل علاقة اعتمادية مع فحص الحلقات عند إعادة التفعيل
   */
  async updateDependency(dependencyId, updates, user = null) {
    const existing = await this.getDependencyById(dependencyId);
    if (!existing) {
      throw new Error(`سجل الاعتمادية [${dependencyId}] غير موجود.`);
    }

    const dependencyType = (updates.dependencyType || updates.dependency_type || existing.dependency_type || existing.dependencyType).toUpperCase();
    const validTypes = ['FS', 'SS', 'FF', 'SF'];
    if (!validTypes.includes(dependencyType)) {
      throw new Error(`نوع العلاقة [${dependencyType}] غير صالح.`);
    }

    const lagDays = Math.max(0, parseInt(updates.lagDays !== undefined ? updates.lagDays : (updates.lag_days !== undefined ? updates.lag_days : (existing.lag_days || 0)), 10));
    const targetStatus = updates.status || existing.status;

    // إذا أعيد تفعيل العلاقة، يجب فحص الحلقات الدائرية إجبارياً
    if (targetStatus === 'ACTIVE' && existing.status !== 'ACTIVE') {
      const predId = existing.predecessor_project_id || existing.predecessorProjectId;
      const succId = existing.successor_project_id || existing.successorProjectId;
      const cycleCheck = await this.detectCycle(predId, succId, existing.id);
      if (cycleCheck.hasCycle) {
        throw new Error(`⛔ لا يمكن تفعيل العلاقة لاكتشاف اعتمادية دائرية مغلقة: [${cycleCheck.cyclePath.join(' ➔ ')}]`);
      }
    }

    const updated = {
      ...existing,
      dependency_type: dependencyType,
      lag_days: lagDays,
      description: updates.description !== undefined ? updates.description : existing.description,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      status: targetStatus,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.project_dependencies
        SET dependency_type = $1, lag_days = $2, description = $3, notes = $4, status = $5, updated_by = $6, updated_at = NOW()
        WHERE id = $7
      `, [updated.dependency_type, updated.lag_days, updated.description, updated.notes, updated.status, user?.id || 'SYSTEM', existing.id]);
    } else {
      const idx = (memDb.project_dependencies || []).findIndex(d => d.id === existing.id);
      if (idx !== -1) {
        memDb.project_dependencies[idx] = { ...memDb.project_dependencies[idx], ...updated };
        saveMemTable('project_dependencies');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PROJECT_DEPENDENCY_UPDATED', existing, updated);
    return updated;
  }

  /**
   * حذف علاقة اعتمادية بأمان
   */
  async deleteDependency(dependencyId, user = null) {
    const existing = await this.getDependencyById(dependencyId);
    if (!existing) {
      throw new Error(`سجل الاعتمادية [${dependencyId}] غير موجود.`);
    }

    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.project_dependencies WHERE id = $1', [existing.id]);
    } else {
      if (memDb.project_dependencies) {
        memDb.project_dependencies = memDb.project_dependencies.filter(d => d.id !== existing.id);
        saveMemTable('project_dependencies');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PROJECT_DEPENDENCY_DELETED', existing, null);
    return { success: true, message: 'تم حذف علاقة الاعتمادية بنجاح.' };
  }

  /**
   * استرجاع شبكة العلاقات لمشروع محدد بنمط الاستعلام الدفعي
   */
  async getProjectDependencies(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    const allPredDeps = await this.getDependencies({ successorProjectId: actualProjectId, status: 'ACTIVE' });
    const allSuccDeps = await this.getDependencies({ predecessorProjectId: actualProjectId, status: 'ACTIVE' });

    // جمع كافة المعرفات للاستعلام الدفعي
    const relatedIds = new Set();
    allPredDeps.forEach(d => relatedIds.add(d.predecessor_project_id || d.predecessorProjectId));
    allSuccDeps.forEach(d => relatedIds.add(d.successor_project_id || d.successorProjectId));

    const projectMap = new Map();
    if (relatedIds.size > 0) {
      const idsArray = Array.from(relatedIds);
      if (isPostgresActive()) {
        const rows = await dbQuery('SELECT id, project_number, project_name, status FROM public.projects WHERE id = ANY($1)', [idsArray]);
        (rows || []).forEach(r => projectMap.set(r.id, r));
      } else {
        (memDb.projects || []).forEach(r => {
          if (relatedIds.has(r.id)) projectMap.set(r.id, r);
        });
      }
    }

    const predecessors = allPredDeps.map(dep => {
      const pId = dep.predecessor_project_id || dep.predecessorProjectId;
      const p = projectMap.get(pId);
      return {
        dependencyId: dep.id,
        projectId: pId,
        projectNumber: p?.project_number || pId,
        projectName: p?.project_name || 'مشروع هندسي',
        status: p?.status || 'DRAFT',
        dependencyType: dep.dependency_type || dep.dependencyType,
        lagDays: dep.lag_days || dep.lagDays || 0,
        notes: dep.notes
      };
    });

    const successors = allSuccDeps.map(dep => {
      const sId = dep.successor_project_id || dep.successorProjectId;
      const s = projectMap.get(sId);
      return {
        dependencyId: dep.id,
        projectId: sId,
        projectNumber: s?.project_number || sId,
        projectName: s?.project_name || 'مشروع هندسي',
        status: s?.status || 'DRAFT',
        dependencyType: dep.dependency_type || dep.dependencyType,
        lagDays: dep.lag_days || dep.lagDays || 0,
        notes: dep.notes
      };
    });

    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      currentStatus: project.status,
      predecessorsCount: predecessors.length,
      successorsCount: successors.length,
      predecessors,
      successors
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ فحص الجاهزية والانسداد الهندسي الدقيق (Readiness & Lag Validation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * فحص جاهزية المشروع لبدء التنفيذ وفق العلاقات وفترات التصلب (Lag Days)
   */
  async validateProjectReadiness(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const predDeps = await this.getDependencies({ successorProjectId: actualProjectId, status: 'ACTIVE' });

    const blockers = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const dep of predDeps) {
      const pId = dep.predecessor_project_id || dep.predecessorProjectId;
      const p = await projectsEngineService.getProjectById(pId);
      const pStatus = p?.status || 'DRAFT';
      const type = dep.dependency_type || dep.dependencyType || 'FS';
      const lagDays = parseInt(dep.lag_days || dep.lagDays || 0, 10);

      let isBlocking = false;
      let reason = '';

      // فحص الجاهزية لبدء التنفيذ
      switch (type) {
        case 'FS': // Finish-to-Start: السابق يجب أن يكون مكتملاً + انقضاء فترة التأخير
          if (!['COMPLETED', 'CLOSED'].includes(pStatus)) {
            isBlocking = true;
            reason = `المشروع السابق لم يكتمل بعد (الحالة الحالية: ${pStatus})`;
          } else if (lagDays > 0 && p?.actual_end_date) {
            const endDate = new Date(p.actual_end_date);
            endDate.setHours(0, 0, 0, 0);
            endDate.setDate(endDate.getDate() + lagDays);
            if (today < endDate) {
              isBlocking = true;
              const remainingDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
              reason = `المشروع السابق مكتمل ولكن فترة المعالجة والتأخير (${lagDays} يوم) لم تنتهِ بعد (متبقي ${remainingDays} يوم)`;
            }
          }
          break;

        case 'SS': // Start-to-Start: السابق يجب أن يكون قد بدأ التنفيذ بالفعل
          if (!['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(pStatus)) {
            isBlocking = true;
            reason = `المشروع السابق لم يبدأ التنفيذ بعد (الحالة الحالية: ${pStatus})`;
          } else if (lagDays > 0 && p?.actual_start_date) {
            const startDate = new Date(p.actual_start_date);
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(startDate.getDate() + lagDays);
            if (today < startDate) {
              isBlocking = true;
              const remainingDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
              reason = `المشروع السابق قيد التنفيذ ولكن فترة التأخير بعد البدء (${lagDays} يوم) لم تنقضِ (متبقي ${remainingDays} يوم)`;
            }
          }
          break;

        case 'FF':
          // علاقة Finish-to-Finish لا تمنع بدء المشروع بل ترتبط بإنهائه؛ لذا لا تمنع البدء
          break;

        case 'SF':
          // علاقة Start-to-Finish لا تمنع بدء المشروع؛ لذا لا تمنع البدء
          break;
      }

      if (isBlocking) {
        blockers.push({
          dependencyId: dep.id,
          predecessorProjectId: pId,
          predecessorProjectNumber: p?.project_number || pId,
          predecessorProjectName: p?.project_name || 'مشروع هندسي',
          predecessorStatus: pStatus,
          dependencyType: type,
          lagDays,
          reason
        });
      }
    }

    const isReady = blockers.length === 0;
    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      readinessStatus: isReady ? 'READY' : 'BLOCKED',
      isReady,
      totalPredecessors: predDeps.length,
      blockersCount: blockers.length,
      blockers
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4️⃣ مخطط شبكة الاعتماديات الشامل (Batch Dependency Graph)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع مخطط شبكة الاعتماديات بنمط الاستعلام الدفعي السريع
   */
  async getDependencyGraph() {
    const deps = await this.getDependencies({ status: 'ACTIVE' });
    const nodeIds = new Set();

    deps.forEach(d => {
      nodeIds.add(d.predecessor_project_id || d.predecessorProjectId);
      nodeIds.add(d.successor_project_id || d.successorProjectId);
    });

    const nodes = [];
    if (nodeIds.size > 0) {
      const idsArray = Array.from(nodeIds);
      let projects = [];
      if (isPostgresActive()) {
        projects = await dbQuery('SELECT id, project_number, project_name, status, budget_amount FROM public.projects WHERE id = ANY($1)', [idsArray]) || [];
      } else {
        projects = (memDb.projects || []).filter(p => nodeIds.has(p.id));
      }

      projects.forEach(p => {
        nodes.push({
          id: p.id,
          projectNumber: p.project_number || p.id,
          projectName: p.project_name || 'مشروع هندسي',
          status: p.status || 'DRAFT',
          budgetAmount: parseFloat(p.budget_amount || 0)
        });
      });
    }

    const edges = deps.map(d => ({
      id: d.id,
      source: d.predecessor_project_id || d.predecessorProjectId,
      target: d.successor_project_id || d.successorProjectId,
      type: d.dependency_type || d.dependencyType,
      lagDays: d.lag_days || d.lagDays || 0
    }));

    return {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodes,
      edges
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalDependencies = 0;
    let activeDependencies = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'ACTIVE') as active FROM public.project_dependencies");
        totalDependencies = parseInt(res?.total || 0, 10);
        activeDependencies = parseInt(res?.active || 0, 10);
      } else {
        const all = memDb.project_dependencies || [];
        totalDependencies = all.length;
        activeDependencies = all.filter(d => d.status === 'ACTIVE').length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalDependencies,
        activeDependencies,
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

module.exports = new ProjectDependencyEngineService();

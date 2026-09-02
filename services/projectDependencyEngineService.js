/**
 * services/projectDependencyEngineService.js
 * 🔗 محرك شبكة واعتماديات تتابع المشاريع الهندسية (PROJECT_DEPENDENCY_ENGINE — Phase 04-D)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة شبكة التتابع والأسبقية (Precedence Network) بين المشاريع الهندسية.
 * 2. دعم العلاقات الأربعة: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish).
 * 3. خوارزمية فحص وكشف الحلقات الدائرية (Cycle Detection - Directed Acyclic Graph / DAG).
 * 4. منع الاعتمادية الذاتية (Self-Dependency) ومنع تكرار العلاقات.
 * 5. فحص الجاهزية للقراءة فقط (Read-Only Readiness Validation) دون تعديل بيانات المشروع.
 * 6. التدقيق الشامل لكافة العمليات الحساسة.
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
    this.version = '1.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'dependency_network',
      'cycle_detection',
      'readiness_validation',
      'dependency_graph'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء اعتماديات المشاريع [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'اعتماديات وتتابع المشاريع', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-DEP-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'اعتماديات وتتابع المشاريع',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('ProjectDependencyEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ كشف التبعيات الدائرية (Cycle Detection Algorithm)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * فحص وجود حلقة مغلقة في شبكة التتابع
   * @param {string} fromProjectId - المشروع السابق (Predecessor)
   * @param {string} toProjectId - المشروع اللاحق (Successor)
   * @param {string} excludeDependencyId - معرف علاقة مستثناة (عند التعديل)
   */
  async detectCycle(fromProjectId, toProjectId, excludeDependencyId = null) {
    if (fromProjectId === toProjectId) {
      return {
        hasCycle: true,
        cyclePath: [fromProjectId, toProjectId]
      };
    }

    // جلب كافة العلاقات النشطة الحالية
    let allDeps = [];
    if (isPostgresActive()) {
      allDeps = await dbQuery("SELECT id, predecessor_project_id, successor_project_id FROM public.project_dependencies WHERE status = 'ACTIVE'");
    } else {
      allDeps = (memDb.project_dependencies || []).filter(d => d.status !== 'CANCELLED');
    }

    // بناء قائمة المجاورة (Adjacency List): predecessor -> [successors]
    const adj = new Map();
    for (const d of allDeps) {
      if (excludeDependencyId && d.id === excludeDependencyId) continue;
      const u = d.predecessor_project_id || d.predecessorProjectId;
      const v = d.successor_project_id || d.successorProjectId;
      if (!adj.has(u)) adj.set(u, []);
      adj.get(u).push(v);
    }

    // إضافة الحافة المقترحة مؤقتاً في الذاكرة
    if (!adj.has(fromProjectId)) adj.set(fromProjectId, []);
    adj.get(fromProjectId).push(toProjectId);

    // البحث في العمق (DFS) للكشف عما إذا كان هناك مسار من toProjectId يعود إلى fromProjectId
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
        } else if (next === target) {
          path.push(next);
          return true;
        }
      }

      path.pop();
      return false;
    };

    const hasPathBack = dfs(toProjectId, fromProjectId);
    if (hasPathBack) {
      return {
        hasCycle: true,
        cyclePath: [fromProjectId, ...path]
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
    const predecessorId = data.predecessorProjectId || data.predecessor_project_id;
    const successorId = data.successorProjectId || data.successor_project_id;
    const dependencyType = (data.dependencyType || data.dependency_type || 'FS').toUpperCase();
    const lagDays = data.lagDays !== undefined ? parseInt(data.lagDays, 10) : (data.lag_days !== undefined ? parseInt(data.lag_days, 10) : 0);

    if (!predecessorId) throw new Error('معرف المشروع السابق (predecessorProjectId) حقل إلزامي.');
    if (!successorId) throw new Error('معرف المشروع اللاحق (successorProjectId) حقل إلزامي.');

    // 1. فحص ومنع الاعتمادية الذاتية (Self-Dependency Prevention)
    if (predecessorId === successorId) {
      throw new Error('لا يمكن للمشروع أن يعتمد على نفسه (Self-Dependency is strictly forbidden).');
    }

    // 2. فحص نوع العلاقة
    const validTypes = ['FS', 'SS', 'FF', 'SF'];
    if (!validTypes.includes(dependencyType)) {
      throw new Error(`نوع العلاقة [${dependencyType}] غير صالح. الأنواع المعتمدة هي: ${validTypes.join(', ')}.`);
    }

    // 3. فحص فترة التأخير (Lag Days)
    if (isNaN(lagDays) || lagDays < 0) {
      throw new Error('فترة التأخير (lag_days) يجب أن تكون رقماً صحيحاً موجباً أو صفراً.');
    }

    // 4. التحقق من وجود كلا المشروعين عبر PROJECTS_ENGINE
    const predProject = await projectsEngineService.getProjectById(predecessorId);
    if (!predProject) {
      throw new Error(`المشروع السابق (Predecessor) [${predecessorId}] غير موجود.`);
    }

    const succProject = await projectsEngineService.getProjectById(successorId);
    if (!succProject) {
      throw new Error(`المشروع اللاحق (Successor) [${successorId}] غير موجود.`);
    }

    const actualPredId = predProject.id;
    const actualSuccId = succProject.id;

    if (actualPredId === actualSuccId) {
      throw new Error('لا يمكن للمشروع أن يعتمد على نفسه (Self-Dependency is strictly forbidden).');
    }

    // 5. فحص منع تكرار العلاقة بين نفس المشروعين (Duplicate Dependency Prevention)
    let duplicate = null;
    if (isPostgresActive()) {
      duplicate = await dbGet('SELECT id FROM public.project_dependencies WHERE predecessor_project_id = $1 AND successor_project_id = $2', [actualPredId, actualSuccId]);
    } else {
      duplicate = (memDb.project_dependencies || []).find(d => 
        (d.predecessor_project_id === actualPredId || d.predecessorProjectId === actualPredId) &&
        (d.successor_project_id === actualSuccId || d.successorProjectId === actualSuccId)
      );
    }
    if (duplicate) {
      throw new Error(`توجد علاقة اعتمادية مسجلة مسبقاً بين المشروع السابق [${predProject.project_number || actualPredId}] واللاحق [${succProject.project_number || actualSuccId}].`);
    }

    // 6. فحص ومنع التبعيات الدائرية (Cycle Detection)
    const cycleCheck = await this.detectCycle(actualPredId, actualSuccId);
    if (cycleCheck.hasCycle) {
      const pathDisplay = cycleCheck.cyclePath.join(' ➔ ');
      throw new Error(`⛔ تم اكتشاف اعتمادية دائرية مغلقة (Circular Dependency Detected): [${pathDisplay}]. لا يمكن حفظ العلاقة.`);
    }

    const dependencyId = data.id || `DEP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
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
      created_at: new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
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
   * استرجاع قائمة الاعتماديات مع الفلاتر
   */
  async getDependencies(filters = {}) {
    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_dependencies WHERE 1=1';
      const params = [];
      if (filters.predecessorProjectId) {
        params.push(filters.predecessorProjectId);
        q += ` AND predecessor_project_id = $${params.length}`;
      }
      if (filters.successorProjectId) {
        params.push(filters.successorProjectId);
        q += ` AND successor_project_id = $${params.length}`;
      }
      if (filters.dependencyType) {
        params.push(filters.dependencyType.toUpperCase());
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
      if (filters.predecessorProjectId) {
        list = list.filter(d => (d.predecessor_project_id || d.predecessorProjectId) === filters.predecessorProjectId);
      }
      if (filters.successorProjectId) {
        list = list.filter(d => (d.successor_project_id || d.successorProjectId) === filters.successorProjectId);
      }
      if (filters.dependencyType) {
        list = list.filter(d => (d.dependency_type || d.dependencyType) === filters.dependencyType.toUpperCase());
      }
      if (filters.status) {
        list = list.filter(d => d.status === filters.status);
      }
      list.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
    }
    return list;
  }

  /**
   * استرجاع سجل علاقة اعتمادية مفرد بالمعرف
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
   * تعديل علاقة اعتمادية
   */
  async updateDependency(dependencyId, updates, user = null) {
    const existing = await this.getDependencyById(dependencyId);
    if (!existing) {
      throw new Error(`سجل الاعتمادية [${dependencyId}] غير موجود.`);
    }

    const dependencyType = updates.dependencyType || updates.dependency_type
      ? (updates.dependencyType || updates.dependency_type).toUpperCase()
      : (existing.dependency_type || existing.dependencyType);

    const validTypes = ['FS', 'SS', 'FF', 'SF'];
    if (!validTypes.includes(dependencyType)) {
      throw new Error(`نوع العلاقة [${dependencyType}] غير صالح.`);
    }

    const lagDays = updates.lagDays !== undefined ? parseInt(updates.lagDays, 10) : (updates.lag_days !== undefined ? parseInt(updates.lag_days, 10) : parseInt(existing.lag_days || existing.lagDays || 0, 10));
    if (isNaN(lagDays) || lagDays < 0) {
      throw new Error('فترة التأخير (lag_days) غير صالحة.');
    }

    const updated = {
      ...existing,
      dependency_type: dependencyType,
      lag_days: lagDays,
      description: updates.description !== undefined ? updates.description : existing.description,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      status: updates.status || existing.status,
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
   * حذف علاقة اعتمادية (دون المساس بالمشاريع)
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
   * استرجاع شبكة العلاقات لمشروع محدد (السابقة واللاحقة)
   */
  async getProjectDependencies(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    const allPredDeps = await this.getDependencies({ successorProjectId: actualProjectId, status: 'ACTIVE' });
    const allSuccDeps = await this.getDependencies({ predecessorProjectId: actualProjectId, status: 'ACTIVE' });

    // استرجاع تفاصيل المشاريع السابقة
    const predecessors = [];
    for (const dep of allPredDeps) {
      const pId = dep.predecessor_project_id || dep.predecessorProjectId;
      const p = await projectsEngineService.getProjectById(pId);
      predecessors.push({
        dependencyId: dep.id,
        projectId: pId,
        projectNumber: p?.project_number || p?.projectNumber || pId,
        projectName: p?.project_name || p?.projectName || 'مشروع هندسي',
        status: p?.status || 'DRAFT',
        dependencyType: dep.dependency_type || dep.dependencyType,
        lagDays: dep.lag_days || dep.lagDays || 0,
        notes: dep.notes
      });
    }

    // استرجاع تفاصيل المشاريع اللاحقة
    const successors = [];
    for (const dep of allSuccDeps) {
      const sId = dep.successor_project_id || dep.successorProjectId;
      const s = await projectsEngineService.getProjectById(sId);
      successors.push({
        dependencyId: dep.id,
        projectId: sId,
        projectNumber: s?.project_number || s?.projectNumber || sId,
        projectName: s?.project_name || s?.projectName || 'مشروع هندسي',
        status: s?.status || 'DRAFT',
        dependencyType: dep.dependency_type || dep.dependencyType,
        lagDays: dep.lag_days || dep.lagDays || 0,
        notes: dep.notes
      });
    }

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
  // 3️⃣ فحص الجاهزية والانسداد (Read-Only Readiness Validation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * فحص جاهزية المشروع للتنفيذ وفق شبكة الاعتماديات
   * ملاحظة معمارية: هذا الفحص للقراءة فقط (Read-Only) ولا يقوم بتعديل حالة المشروع.
   */
  async validateProjectReadiness(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const predDeps = await this.getDependencies({ successorProjectId: actualProjectId, status: 'ACTIVE' });

    const blockers = [];
    for (const dep of predDeps) {
      const pId = dep.predecessor_project_id || dep.predecessorProjectId;
      const p = await projectsEngineService.getProjectById(pId);
      const pStatus = p?.status || 'DRAFT';
      const type = dep.dependency_type || dep.dependencyType || 'FS';

      let isBlocking = false;
      let reason = '';

      switch (type) {
        case 'FS': // Finish-to-Start: السابق يجب أن يكون مكتملاً (COMPLETED أو CLOSED)
          if (pStatus !== 'COMPLETED' && pStatus !== 'CLOSED') {
            isBlocking = true;
            reason = `المشروع السابق لم يكتمل بعد (الحالة الحالية: ${pStatus})`;
          }
          break;
        case 'SS': // Start-to-Start: السابق يجب أن يكون قد بدأ على الأقل (IN_PROGRESS أو COMPLETED أو CLOSED)
          if (!['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(pStatus)) {
            isBlocking = true;
            reason = `المشروع السابق لم يبدأ التنفيذ بعد (الحالة الحالية: ${pStatus})`;
          }
          break;
        case 'FF': // Finish-to-Finish: السابق يجب أن يكون مكتملاً قبل إتمام اللاحق
          if (pStatus !== 'COMPLETED' && pStatus !== 'CLOSED') {
            isBlocking = true;
            reason = `إنهاء المشروع يتطلب أولاً إتمام المشروع السابق (الحالة الحالية: ${pStatus})`;
          }
          break;
        case 'SF': // Start-to-Finish: السابق يجب أن يكون قد بدأ قبل إتمام اللاحق
          if (!['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(pStatus)) {
            isBlocking = true;
            reason = `إنهاء المشروع يتطلب أولاً بدء المشروع السابق (الحالة الحالية: ${pStatus})`;
          }
          break;
      }

      if (isBlocking) {
        blockers.push({
          dependencyId: dep.id,
          predecessorProjectId: pId,
          predecessorProjectNumber: p?.project_number || p?.projectNumber || pId,
          predecessorProjectName: p?.project_name || p?.projectName || 'مشروع هندسي',
          predecessorStatus: pStatus,
          dependencyType: type,
          lagDays: dep.lag_days || dep.lagDays || 0,
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
  // 4️⃣ مخطط شبكة الاعتماديات الشامل (Dependency Graph)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع مخطط شبكة الاعتماديات للمشاريع
   */
  async getDependencyGraph() {
    const deps = await this.getDependencies({ status: 'ACTIVE' });
    const nodeIds = new Set();

    deps.forEach(d => {
      nodeIds.add(d.predecessor_project_id || d.predecessorProjectId);
      nodeIds.add(d.successor_project_id || d.successorProjectId);
    });

    const nodes = [];
    for (const pId of nodeIds) {
      const p = await projectsEngineService.getProjectById(pId);
      nodes.push({
        id: pId,
        projectNumber: p?.project_number || p?.projectNumber || pId,
        projectName: p?.project_name || p?.projectName || 'مشروع هندسي',
        status: p?.status || 'DRAFT',
        budgetAmount: parseFloat(p?.budget_amount || p?.budgetAmount || 0)
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

const projectDependencyEngineService = new ProjectDependencyEngineService();
module.exports = projectDependencyEngineService;

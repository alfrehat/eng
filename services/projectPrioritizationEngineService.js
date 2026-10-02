/**
 * services/projectPrioritizationEngineService.js
 * ⚖️ محرك ترجيح وأولويات المشاريع الهندسية (PROJECT_PRIORITIZATION_ENGINE)
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

class ProjectPrioritizationEngineService {
  constructor() {
    this.engineId = 'PROJECT_PRIORITIZATION_ENGINE';
    this.engineName = 'Enterprise Project Prioritization & Scoring Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'criteria_weighting',
      'project_scoring',
      'priority_ranking',
      'score_recalculation',
      'cascade_reweighting'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء أولويات المشاريع [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أولويات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ProjectPrioritizationEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة معايير الأولوية والترجيح (Criteria Management)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء معيار تقييم جديد
   */
  async createPriorityCriterion(data, user = null) {
    const code = (data.code || '').trim().toUpperCase();
    if (!code) {
      throw new Error('رمز المعيار (code) حقل إلزامي.');
    }
    const weight = parseFloat(data.weight);
    if (isNaN(weight) || weight < 0) {
      throw new Error('وزن المعيار (weight) يجب أن يكون قيمة رقمية غير سالبة.');
    }
    const rawMaxScore = data.maxScore !== undefined ? data.maxScore : (data.max_score !== undefined ? data.max_score : 10.0);
    const maxScore = parseFloat(rawMaxScore);
    if (isNaN(maxScore) || maxScore <= 0) {
      throw new Error('الحد الأقصى للنقاط (max_score) يجب أن يكون أكبر من الصفر.');
    }

    let duplicate = null;
    if (isPostgresActive()) {
      duplicate = await dbGet('SELECT id FROM public.project_priority_criteria WHERE code = $1', [code]);
    } else {
      duplicate = (memDb.project_priority_criteria || []).find(c => c.code === code);
    }
    if (duplicate) {
      throw new Error(`معيار التقييم بالرمز [${code}] موجود مسبقاً.`);
    }

    const criterionId = data.id || `CRT-${code}-${Date.now().toString(36)}`;
    const record = {
      id: criterionId,
      code,
      name: data.name || code,
      description: data.description || '',
      weight,
      max_score: maxScore,
      active: data.active !== false,
      created_by: user?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_priority_criteria
        (id, code, name, description, weight, max_score, active, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, Object.values(record));
    } else {
      if (!memDb.project_priority_criteria) memDb.project_priority_criteria = [];
      memDb.project_priority_criteria.push(record);
      saveMemTable('project_priority_criteria');
    }

    await this._recordAudit(user?.id, criterionId, 'PRIORITY_CRITERION_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع قائمة معايير التقييم
   */
  async getPriorityCriteria(filters = {}) {
    let list = [];
    if (isPostgresActive()) {
      let q = 'SELECT * FROM public.project_priority_criteria WHERE 1=1';
      const params = [];
      if (typeof filters.active === 'boolean') {
        params.push(filters.active);
        q += ` AND active = $${params.length}`;
      }
      q += ' ORDER BY created_at ASC';
      list = await dbQuery(q, params);
    } else {
      list = (memDb.project_priority_criteria || []).slice();
      if (typeof filters.active === 'boolean') {
        list = list.filter(c => Boolean(c.active) === filters.active);
      }
      list.sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));
    }
    return list || [];
  }

  /**
   * استرجاع معيار مفرد بالمعرف
   */
  async getPriorityCriterionById(criterionId) {
    if (!criterionId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.project_priority_criteria WHERE id = $1 OR code = $1', [criterionId]);
    } else {
      return (memDb.project_priority_criteria || []).find(c => c.id === criterionId || c.code === criterionId) || null;
    }
  }

  /**
   * تعديل معيار تقييم مع إعادة احتساب الدرجات التابعة له آلياً
   */
  async updatePriorityCriterion(criterionId, updates, user = null) {
    const existing = await this.getPriorityCriterionById(criterionId);
    if (!existing) {
      throw new Error(`معيار التقييم [${criterionId}] غير موجود.`);
    }

    const weight = updates.weight !== undefined ? parseFloat(updates.weight) : parseFloat(existing.weight);
    if (isNaN(weight) || weight < 0) {
      throw new Error('الوزن النسبي يجب أن يكون غير سالب.');
    }
    const maxScore = updates.maxScore !== undefined || updates.max_score !== undefined
      ? parseFloat(updates.maxScore || updates.max_score)
      : parseFloat(existing.max_score || existing.maxScore || 10.0);
    if (isNaN(maxScore) || maxScore <= 0) {
      throw new Error('الحد الأقصى للنقاط يجب أن يكون أكبر من الصفر.');
    }

    const updated = {
      ...existing,
      name: updates.name || existing.name,
      description: updates.description !== undefined ? updates.description : existing.description,
      weight,
      max_score: maxScore,
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.project_priority_criteria
        SET name = $1, description = $2, weight = $3, max_score = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6
      `, [updated.name, updated.description, updated.weight, updated.max_score, user?.id || 'SYSTEM', existing.id]);

      // تحديث تسلسلي للدرجات الموزونة التابعة لهذا المعيار
      await dbRun(`
        UPDATE public.project_priority_scores
        SET weighted_score = ROUND(((score / $1) * $2)::numeric, 2), updated_at = NOW()
        WHERE criterion_id = $3
      `, [updated.max_score, updated.weight, existing.id]);
    } else {
      const idx = (memDb.project_priority_criteria || []).findIndex(c => c.id === existing.id);
      if (idx !== -1) {
        memDb.project_priority_criteria[idx] = { ...memDb.project_priority_criteria[idx], ...updated };
        saveMemTable('project_priority_criteria');
      }

      // تحديث محلي في الذاكرة
      if (memDb.project_priority_scores) {
        memDb.project_priority_scores.forEach(s => {
          if (s.criterion_id === existing.id || s.criterionId === existing.id) {
            const rawScore = parseFloat(s.score || 0);
            s.weighted_score = Math.round(((rawScore / updated.max_score) * updated.weight) * 100) / 100;
          }
        });
        saveMemTable('project_priority_scores');
      }
    }

    // إعادة احتساب المجاميع والترتيب لكافة المشاريع المتأثرة
    await this.recalculateAllProjectPriorities(user);
    await this._recordAudit(user?.id, existing.id, 'PRIORITY_CRITERION_UPDATED', existing, updated);
    return updated;
  }

  /**
   * تفعيل معيار وإعادة احتساب المجاميع المتأثرة
   */
  async activatePriorityCriterion(criterionId, user = null) {
    const existing = await this.getPriorityCriterionById(criterionId);
    if (!existing) throw new Error(`معيار التقييم [${criterionId}] غير موجود.`);

    if (isPostgresActive()) {
      await dbRun('UPDATE public.project_priority_criteria SET active = TRUE, updated_at = NOW(), updated_by = $1 WHERE id = $2', [user?.id || 'SYSTEM', existing.id]);
    } else {
      const idx = (memDb.project_priority_criteria || []).findIndex(c => c.id === existing.id);
      if (idx !== -1) {
        memDb.project_priority_criteria[idx].active = true;
        saveMemTable('project_priority_criteria');
      }
    }

    await this.recalculateAllProjectPriorities(user);
    await this._recordAudit(user?.id, existing.id, 'PRIORITY_CRITERION_ACTIVATED', { active: false }, { active: true });
    return { success: true, message: 'تم تفعيل معيار التقييم وتحديث ترتيب المشاريع بنجاح.' };
  }

  /**
   * تعطيل معيار وإعادة احتساب المجاميع آلياً
   */
  async deactivatePriorityCriterion(criterionId, user = null) {
    const existing = await this.getPriorityCriterionById(criterionId);
    if (!existing) throw new Error(`معيار التقييم [${criterionId}] غير موجود.`);

    if (isPostgresActive()) {
      await dbRun('UPDATE public.project_priority_criteria SET active = FALSE, updated_at = NOW(), updated_by = $1 WHERE id = $2', [user?.id || 'SYSTEM', existing.id]);
    } else {
      const idx = (memDb.project_priority_criteria || []).findIndex(c => c.id === existing.id);
      if (idx !== -1) {
        memDb.project_priority_criteria[idx].active = false;
        saveMemTable('project_priority_criteria');
      }
    }

    await this.recalculateAllProjectPriorities(user);
    await this._recordAudit(user?.id, existing.id, 'PRIORITY_CRITERION_DEACTIVATED', { active: true }, { active: false });
    return { success: true, message: 'تم تعطيل معيار التقييم وتحديث ترتيب المشاريع بنجاح.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ تقييم واحتساب درجات المشروع (Project Scoring & Recalculation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * تسجيل أو تحديث درجة مشروع لمعيار معين
   */
  async setProjectCriterionScore(projectId, criterionId, scoreValue, notes = '', user = null) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) {
      throw new Error(`المشروع الهندسي [${projectId}] غير موجود.`);
    }

    const criterion = await this.getPriorityCriterionById(criterionId);
    if (!criterion) {
      throw new Error(`معيار التقييم [${criterionId}] غير موجود.`);
    }
    if (!criterion.active) {
      throw new Error(`معيار التقييم [${criterion.name || criterion.code}] معطل ولا يمكن تسجيل نقاط عليه.`);
    }

    const score = parseFloat(scoreValue);
    const maxScore = parseFloat(criterion.max_score || criterion.maxScore || 10.0);
    if (isNaN(score) || score < 0 || score > maxScore) {
      throw new Error(`الدرجة [${scoreValue}] غير صالحة. يجب أن تكون بين 0 و ${maxScore}.`);
    }

    const weight = parseFloat(criterion.weight || 0);
    const weightedScore = maxScore > 0 ? Math.round(((score / maxScore) * weight) * 100) / 100 : 0;
    const actualProjectId = project.id;
    const actualCriterionId = criterion.id;

    let existingScore = null;
    if (isPostgresActive()) {
      existingScore = await dbGet('SELECT * FROM public.project_priority_scores WHERE project_id = $1 AND criterion_id = $2', [actualProjectId, actualCriterionId]);
    } else {
      existingScore = (memDb.project_priority_scores || []).find(s => 
        (s.project_id === actualProjectId || s.projectId === actualProjectId) && 
        (s.criterion_id === actualCriterionId || s.criterionId === actualCriterionId)
      );
    }

    const scoreRecord = {
      id: existingScore?.id || `SCR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      project_id: actualProjectId,
      criterion_id: actualCriterionId,
      score,
      weighted_score: weightedScore,
      notes: notes || '',
      created_by: existingScore?.created_by || user?.id || 'SYSTEM',
      created_at: existingScore?.created_at || new Date().toISOString(),
      updated_by: user?.id || 'SYSTEM',
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_priority_scores
        (id, project_id, criterion_id, score, weighted_score, notes, created_by, created_at, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (project_id, criterion_id) DO UPDATE
        SET score = EXCLUDED.score, weighted_score = EXCLUDED.weighted_score, notes = EXCLUDED.notes,
            updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `, Object.values(scoreRecord));
    } else {
      if (!memDb.project_priority_scores) memDb.project_priority_scores = [];
      const idx = memDb.project_priority_scores.findIndex(s => 
        (s.project_id === actualProjectId || s.projectId === actualProjectId) && 
        (s.criterion_id === actualCriterionId || s.criterionId === actualCriterionId)
      );
      if (idx !== -1) {
        memDb.project_priority_scores[idx] = scoreRecord;
      } else {
        memDb.project_priority_scores.push(scoreRecord);
      }
      saveMemTable('project_priority_scores');
    }

    await this._recordAudit(user?.id, actualProjectId, 'PROJECT_PRIORITY_SCORE_SET', existingScore, scoreRecord);

    const totalResult = await this.calculateProjectPriority(actualProjectId, user);
    return {
      success: true,
      score: scoreRecord,
      totalResult
    };
  }

  /**
   * استرجاع تفاصيل تقييمات معايير المشروع
   */
  async getProjectScores(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return [];

    const actualProjectId = project.id;
    let scores = [];
    if (isPostgresActive()) {
      scores = await dbQuery(`
        SELECT s.*, c.code, c.name as criterion_name, c.weight, c.max_score, c.active
        FROM public.project_priority_scores s
        JOIN public.project_priority_criteria c ON s.criterion_id = c.id
        WHERE s.project_id = $1
        ORDER BY c.created_at ASC
      `, [actualProjectId]);
    } else {
      const allCrit = memDb.project_priority_criteria || [];
      const rawScores = (memDb.project_priority_scores || []).filter(s => s.project_id === actualProjectId || s.projectId === actualProjectId);
      scores = rawScores.map(s => {
        const c = allCrit.find(cr => cr.id === s.criterion_id || cr.id === s.criterionId) || {};
        return {
          ...s,
          code: c.code,
          criterion_name: c.name,
          weight: c.weight,
          max_score: c.max_score || c.maxScore,
          active: c.active !== false
        };
      });
    }

    return scores || [];
  }

  /**
   * احتساب الدرجة الإجمالية لأولوية المشروع
   */
  async calculateProjectPriority(projectId, user = null) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) throw new Error(`المشروع [${projectId}] غير موجود.`);

    const actualProjectId = project.id;
    const scores = await this.getProjectScores(actualProjectId);

    let totalScore = 0;
    scores.forEach(s => {
      if (s.active !== false) {
        totalScore += parseFloat(s.weighted_score || s.weightedScore || 0);
      }
    });

    totalScore = Math.round(totalScore * 100) / 100;

    let existingResult = null;
    if (isPostgresActive()) {
      existingResult = await dbGet('SELECT * FROM public.project_priority_results WHERE project_id = $1', [actualProjectId]);
    } else {
      existingResult = (memDb.project_priority_results || []).find(r => r.project_id === actualProjectId || r.projectId === actualProjectId);
    }

    const resultRecord = {
      id: existingResult?.id || `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      project_id: actualProjectId,
      total_score: totalScore,
      rank: existingResult?.rank || 0,
      calculation_version: 'v2.0',
      calculated_at: new Date().toISOString(),
      calculated_by: user?.id || 'SYSTEM'
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.project_priority_results
        (id, project_id, total_score, rank, calculation_version, calculated_at, calculated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (project_id) DO UPDATE
        SET total_score = EXCLUDED.total_score, calculation_version = EXCLUDED.calculation_version,
            calculated_at = NOW(), calculated_by = EXCLUDED.calculated_by
      `, Object.values(resultRecord));
    } else {
      if (!memDb.project_priority_results) memDb.project_priority_results = [];
      const idx = memDb.project_priority_results.findIndex(r => r.project_id === actualProjectId || r.projectId === actualProjectId);
      if (idx !== -1) {
        memDb.project_priority_results[idx] = resultRecord;
      } else {
        memDb.project_priority_results.push(resultRecord);
      }
      saveMemTable('project_priority_results');
    }

    return {
      ...resultRecord,
      totalScore
    };
  }

  /**
   * إعادة احتساب الأولويات لكافة المشاريع التي تملك تقييمات
   */
  async recalculateAllProjectPriorities(user = null) {
    let projectIds = [];
    if (isPostgresActive()) {
      const rows = await dbQuery('SELECT DISTINCT project_id FROM public.project_priority_scores');
      projectIds = (rows || []).map(r => r.project_id);
    } else {
      const set = new Set((memDb.project_priority_scores || []).map(s => s.project_id || s.projectId));
      projectIds = Array.from(set);
    }

    for (const pId of projectIds) {
      try {
        await this.calculateProjectPriority(pId, user);
      } catch (e) {
        logWarn('ProjectPrioritizationEngine', `Failed to recalculate project [${pId}]: ${e.message}`);
      }
    }

    // إعادة الفرز والترتيب العام تلقائياً
    return await this.rankProjects();
  }

  /**
   * استرجاع نتيجة وأولويات مشروع مفرد
   */
  async getProjectPriority(projectId) {
    const project = await projectsEngineService.getProjectById(projectId);
    if (!project) return null;

    const actualProjectId = project.id;
    let result = null;
    if (isPostgresActive()) {
      result = await dbGet('SELECT * FROM public.project_priority_results WHERE project_id = $1', [actualProjectId]);
    } else {
      result = (memDb.project_priority_results || []).find(r => r.project_id === actualProjectId || r.projectId === actualProjectId);
    }

    const scores = await this.getProjectScores(actualProjectId);

    return {
      projectId: actualProjectId,
      projectNumber: project.project_number || project.projectNumber,
      projectName: project.project_name || project.projectName,
      totalScore: result ? parseFloat(result.total_score || result.totalScore || 0) : 0,
      rank: result?.rank || null,
      calculatedAt: result?.calculated_at || result?.calculatedAt || null,
      scoresBreakdown: scores
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ ترتيب المشاريع وتوليد قائمة الأولويات الحتمية (Deterministic Batch Ranking)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ترتيب المشاريع النشطة فقط واستبعاد المشاريع الملغاة والمغلقة دفعة واحدة
   */
  async rankProjects() {
    let results = [];
    if (isPostgresActive()) {
      // ربط مباشر لاستبعاد المشاريع الملغاة والمغلقة وجلب بيانات المشروع دفعة واحدة
      const sql = `
        SELECT r.id as result_id, r.project_id, r.total_score,
               p.project_number, p.project_name, p.status, p.budget_amount
        FROM public.project_priority_results r
        JOIN public.projects p ON r.project_id = p.id
        WHERE p.status NOT IN ('CANCELLED', 'CLOSED')
        ORDER BY r.total_score DESC, r.project_id ASC
      `;
      results = await dbQuery(sql) || [];

      // تحديث الرتب عبر معاملة دفعية واحدة
      if (results.length > 0) {
        const updateCases = results.map((r, i) => `WHEN '${r.result_id}' THEN ${i + 1}`).join(' ');
        const idsList = results.map(r => `'${r.result_id}'`).join(', ');
        await dbRun(`
          UPDATE public.project_priority_results
          SET rank = CASE id ${updateCases} END
          WHERE id IN (${idsList})
        `);
      }
    } else {
      const allProjects = memDb.projects || [];
      const validResults = (memDb.project_priority_results || []).filter(r => {
        const p = allProjects.find(pr => pr.id === (r.project_id || r.projectId));
        return p && !['CANCELLED', 'CLOSED'].includes(p.status);
      });

      validResults.sort((a, b) => {
        const scoreA = parseFloat(a.total_score || a.totalScore || 0);
        const scoreB = parseFloat(b.total_score || b.totalScore || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return String(a.project_id || a.projectId).localeCompare(String(b.project_id || b.projectId));
      });

      results = validResults.map(r => {
        const p = allProjects.find(pr => pr.id === (r.project_id || r.projectId));
        return {
          result_id: r.id,
          project_id: r.project_id || r.projectId,
          total_score: r.total_score,
          project_number: p?.project_number,
          project_name: p?.project_name,
          status: p?.status,
          budget_amount: p?.budget_amount
        };
      });

      results.forEach((r, idx) => {
        const item = memDb.project_priority_results.find(res => res.id === r.result_id);
        if (item) item.rank = idx + 1;
      });
      saveMemTable('project_priority_results');
    }

    return results.map((r, idx) => ({
      rank: idx + 1,
      projectId: r.project_id,
      projectNumber: r.project_number || r.project_id,
      projectName: r.project_name || 'مشروع هندسي',
      totalScore: parseFloat(r.total_score || 0),
      status: r.status || 'ACTIVE',
      budgetAmount: parseFloat(r.budget_amount || 0)
    }));
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalCriteria = 0;
    let totalScoredProjects = 0;
    try {
      if (isPostgresActive()) {
        const critRes = await dbGet('SELECT COUNT(*) as count FROM public.project_priority_criteria');
        const projRes = await dbGet('SELECT COUNT(*) as count FROM public.project_priority_results');
        totalCriteria = parseInt(critRes?.count || 0, 10);
        totalScoredProjects = parseInt(projRes?.count || 0, 10);
      } else {
        totalCriteria = (memDb.project_priority_criteria || []).length;
        totalScoredProjects = (memDb.project_priority_results || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalCriteria,
        totalScoredProjects,
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

module.exports = new ProjectPrioritizationEngineService();

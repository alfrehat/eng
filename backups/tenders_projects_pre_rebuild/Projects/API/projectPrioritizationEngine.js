/**
 * Projects/API/projectPrioritizationEngine.js
 * ⚖️ واجهات برمجة التطبيقات لترجيح وأولويات المشاريع (Project Prioritization REST API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const projectPrioritizationEngineService = require('../../services/projectPrioritizationEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ مسارات معايير الأولوية والترجيح (Criteria Endpoints)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع كافة معايير التقييم
router.get('/criteria', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.VIEW'), async (req, res) => {
  try {
    const filters = {};
    if (req.query.active !== undefined) {
      filters.active = req.query.active === 'true';
    }
    const list = await projectPrioritizationEngineService.getPriorityCriteria(filters);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء معيار تقييم جديد
router.post('/criteria', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.CREATE'), async (req, res) => {
  try {
    const created = await projectPrioritizationEngineService.createPriorityCriterion(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء معيار التقييم بنجاح.',
      data: created
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تعديل معيار تقييم
router.put('/criteria/:id', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.EDIT'), async (req, res) => {
  try {
    const updated = await projectPrioritizationEngineService.updatePriorityCriterion(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث معيار التقييم بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تفعيل معيار
router.post('/criteria/:id/activate', requireAuth, rbacManager.requirePermission(['PROJECT_PRIORITY.MANAGE', 'PROJECT_PRIORITY.EDIT']), async (req, res) => {
  try {
    const result = await projectPrioritizationEngineService.activatePriorityCriterion(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تعطيل معيار
router.post('/criteria/:id/deactivate', requireAuth, rbacManager.requirePermission(['PROJECT_PRIORITY.MANAGE', 'PROJECT_PRIORITY.EDIT']), async (req, res) => {
  try {
    const result = await projectPrioritizationEngineService.deactivatePriorityCriterion(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ مسارات تقييم وترتيب أولويات المشاريع (Project Scoring & Ranking)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع القائمة العامة لترتيب المشاريع (Ranking)
router.get('/projects/ranking', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.VIEW'), async (req, res) => {
  try {
    const ranking = await projectPrioritizationEngineService.rankProjects();
    res.json({ success: true, count: ranking.length, data: ranking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع درجات وأولوية مشروع مفرد
router.get('/projects/:projectId', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.VIEW'), async (req, res) => {
  try {
    const priority = await projectPrioritizationEngineService.getProjectPriority(req.params.projectId);
    if (!priority) {
      return res.status(404).json({ success: false, error: 'المشروع غير موجود أو لم يتم تقييمه بعد.' });
    }
    res.json({ success: true, data: priority });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تسجيل أو تحديث درجات معيار لمشروع
router.post('/projects/:projectId/scores', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.MANAGE'), async (req, res) => {
  try {
    const { criterionId, score, notes } = req.body;
    if (!criterionId || score === undefined) {
      return res.status(400).json({ success: false, error: 'يجب تحديد معرف المعيار (criterionId) والدرجة (score).' });
    }
    const result = await projectPrioritizationEngineService.setProjectCriterionScore(
      req.params.projectId,
      criterionId,
      score,
      notes,
      req.user
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إعادة احتساب أولوية مشروع
router.post('/projects/:projectId/recalculate', requireAuth, rbacManager.requirePermission('PROJECT_PRIORITY.MANAGE'), async (req, res) => {
  try {
    const result = await projectPrioritizationEngineService.recalculateProjectPriority(req.params.projectId, req.user);
    res.json({ success: true, message: 'تمت إعادة احتساب الأولوية بنجاح.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

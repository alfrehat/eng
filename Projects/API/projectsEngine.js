/**
 * Projects/API/projectsEngine.js
 * 🏗️ واجهات برمجة التطبيقات لإدارة المشاريع الهندسية (Enterprise Projects REST API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const projectsEngineService = require('../../services/projectsEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

// 1. استرجاع قائمة المشاريع مع الفلاتر والبحث
router.get('/', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      departmentId: req.query.departmentId,
      projectManagerId: req.query.projectManagerId,
      search: req.query.search
    };
    const projects = await projectsEngineService.getProjects(filters, req.user);
    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// نقطة فحص الجاهزية التشغيلية للمحرك (Public Health Probe)
router.get('/health', async (req, res) => {
  const health = await projectsEngineService.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

// إحصائيات عامة للمشاريع
router.get('/stats', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const projects = await projectsEngineService.getProjects({}, req.user);
    const totalProjects = projects.length;
    const inProgress = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'CONTRACTED').length;
    const completed = projects.filter(p => p.status === 'COMPLETED' || p.status === 'CLOSED').length;
    const totalApprovedBudget = projects.reduce((sum, p) => sum + parseFloat(p.approved_budget || p.budget_amount || 0), 0);
    const totalActualCost = projects.reduce((sum, p) => sum + parseFloat(p.actual_cost || 0), 0);

    res.json({
      success: true,
      data: {
        totalProjects,
        inProgress,
        completed,
        totalApprovedBudget,
        totalActualCost
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. استرجاع بيانات مشروع مفرد مع كافة التفاصيل
router.get('/:id', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const project = await projectsEngineService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. إنشاء مشروع هندسي جديد
router.post('/', requireAuth, rbacManager.requirePermission('PROJECTS.CREATE'), async (req, res) => {
  try {
    const project = await projectsEngineService.createProject(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء المشروع وتوثيقه بنجاح.',
      data: project
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. تعديل بيانات المشروع
router.put('/:id', requireAuth, rbacManager.requirePermission('PROJECTS.EDIT'), async (req, res) => {
  try {
    const updated = await projectsEngineService.updateProject(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات المشروع بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. حذف مشروع
router.delete('/:id', requireAuth, rbacManager.requirePermission('PROJECTS.DELETE'), async (req, res) => {
  try {
    const result = await projectsEngineService.deleteProject(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. مسارات دورة الحياة والموافقات (Workflow State Transitions)
router.post('/:id/submit', requireAuth, rbacManager.requirePermission(['PROJECTS.SUBMIT', 'PROJECTS.EDIT']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'SUBMITTED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/review', requireAuth, rbacManager.requirePermission(['PROJECTS.REVIEW', 'PROJECTS.EDIT']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'UNDER_REVIEW', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', requireAuth, rbacManager.requirePermission('PROJECTS.APPROVE', {
  checkSoD: true,
  entityExtractor: async (req) => await projectsEngineService.getProjectById(req.params.id)
}), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'APPROVED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/suspend', requireAuth, rbacManager.requirePermission(['PROJECTS.SUSPEND', 'PROJECTS.EDIT']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'SUSPENDED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/resume', requireAuth, rbacManager.requirePermission(['PROJECTS.RESUME', 'PROJECTS.EDIT']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'IN_PROGRESS', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/complete', requireAuth, rbacManager.requirePermission(['PROJECTS.COMPLETE', 'PROJECTS.EDIT']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'COMPLETED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/close', requireAuth, rbacManager.requirePermission(['PROJECTS.CLOSE', 'PROJECTS.MANAGE']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'CLOSED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/cancel', requireAuth, rbacManager.requirePermission(['PROJECTS.CANCEL', 'PROJECTS.DELETE', 'PROJECTS.MANAGE']), async (req, res) => {
  try {
    const result = await projectsEngineService.transitionStatus(req.params.id, 'CANCELLED', req.user, req.body.remarks);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. إدارة معالم ومراحل المشروع (Milestones)
router.get('/:id/milestones', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const project = await projectsEngineService.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data: project.milestones || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/milestones', requireAuth, rbacManager.requirePermission(['PROJECTS.EDIT', 'PROJECTS.CREATE']), async (req, res) => {
  try {
    const milestone = await projectsEngineService.addMilestone(req.params.id, req.body, req.user);
    res.status(201).json({ success: true, message: 'تمت إضافة المعلم بنجاح.', data: milestone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. إدارة المخاطر (Risks)
router.get('/:id/risks', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const project = await projectsEngineService.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data: project.risks || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/risks', requireAuth, rbacManager.requirePermission(['PROJECTS.EDIT', 'PROJECTS.CREATE']), async (req, res) => {
  try {
    const risk = await projectsEngineService.addRisk(req.params.id, req.body, req.user);
    res.status(201).json({ success: true, message: 'تم تسجيل المخاطر بنجاح.', data: risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. إدارة التقدم والنسب الميدانية (Progress Logs)
router.get('/:id/progress', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const project = await projectsEngineService.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data: project.progressLogs || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/progress', requireAuth, rbacManager.requirePermission(['PROJECTS.EDIT', 'PROJECTS.CREATE']), async (req, res) => {
  try {
    const log = await projectsEngineService.addProgressLog(req.params.id, req.body, req.user);
    res.status(201).json({ success: true, message: 'تم تسجيل تقرير التقدم بنجاح وتحديث نسب المشروع.', data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. الملخص المالي والربط عبر الوحدات (Financial Summary)
router.get('/:id/financial-summary', requireAuth, rbacManager.requirePermission('PROJECTS.VIEW'), async (req, res) => {
  try {
    const project = await projectsEngineService.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data: project.financialSummary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

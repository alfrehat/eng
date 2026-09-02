/**
 * Projects/API/projectDependencyEngine.js
 * 🔗 واجهات برمجة التطبيقات لشبكة واعتماديات تتابع المشاريع (Project Dependencies REST API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const projectDependencyEngineService = require('../../services/projectDependencyEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ مسارات شبكة واعتماديات المشاريع (Dependency Endpoints)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع قائمة الاعتماديات مع الفلاتر
router.get('/', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.VIEW'), async (req, res) => {
  try {
    const filters = {
      predecessorProjectId: req.query.predecessorProjectId,
      successorProjectId: req.query.successorProjectId,
      dependencyType: req.query.dependencyType,
      status: req.query.status
    };
    const list = await projectDependencyEngineService.getDependencies(filters);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع المخطط الهيكلي لشبكة الاعتماديات (Dependency Graph)
router.get('/graph', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.VIEW'), async (req, res) => {
  try {
    const graph = await projectDependencyEngineService.getDependencyGraph();
    res.json({ success: true, data: graph });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع فحص جاهزية مشروع للتنفيذ (Read-Only Readiness Validation)
router.get('/project/:projectId/readiness', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.VIEW'), async (req, res) => {
  try {
    const readiness = await projectDependencyEngineService.validateProjectReadiness(req.params.projectId);
    res.json({ success: true, data: readiness });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// استرجاع شبكة الاعتماديات (السابقة واللاحقة) لمشروع محدد
router.get('/project/:projectId', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.VIEW'), async (req, res) => {
  try {
    const data = await projectDependencyEngineService.getProjectDependencies(req.params.projectId);
    if (!data) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع سجل اعتمادية مفرد بالمعرف
router.get('/:id', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.VIEW'), async (req, res) => {
  try {
    const record = await projectDependencyEngineService.getDependencyById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'سجل الاعتمادية غير موجود.' });
    }
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء علاقة اعتمادية وأسبقية جديدة بين مشروعين
router.post('/', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.CREATE'), async (req, res) => {
  try {
    const created = await projectDependencyEngineService.createDependency(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء وتوثيق علاقة الاعتمادية بنجاح.',
      data: created
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تعديل علاقة اعتمادية
router.put('/:id', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.EDIT'), async (req, res) => {
  try {
    const updated = await projectDependencyEngineService.updateDependency(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث سجل الاعتمادية بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// حذف علاقة اعتمادية
router.delete('/:id', requireAuth, rbacManager.requirePermission('PROJECT_DEPENDENCY.DELETE'), async (req, res) => {
  try {
    const result = await projectDependencyEngineService.deleteDependency(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

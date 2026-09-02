/**
 * Projects/API/projectSchedulingEngine.js
 * ⏱️ واجهات برمجة التطبيقات للجدولة الزمنية وحسابات المسار الحرج (Project Scheduling & CPM REST API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const projectSchedulingEngineService = require('../../services/projectSchedulingEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ مسارات شبكة الجدولة الزمنية والمسار الحرج (Network Scheduling & CPM)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع حسابات المسار الحرج الشاملة للشبكة
router.get('/network/cpm', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.VIEW'), async (req, res) => {
  try {
    const filters = {
      departmentId: req.query.departmentId,
      status: req.query.status
    };
    const result = await projectSchedulingEngineService.calculateNetworkCPM(filters, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع مسار المشاريع الحرجة فقط (Critical Path)
router.get('/network/critical-path', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.VIEW'), async (req, res) => {
  try {
    const filters = {
      departmentId: req.query.departmentId
    };
    const result = await projectSchedulingEngineService.getCriticalPath(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// رصد وكشف التعارضات الزمنية في الجدول المخطط (Schedule Conflicts)
router.get('/network/conflicts', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.VIEW'), async (req, res) => {
  try {
    const conflicts = await projectSchedulingEngineService.detectScheduleConflicts();
    res.json({ success: true, data: conflicts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إعادة احتساب الجدولة والمسار الحرج لكامل الشبكة (POST)
router.post('/network/calculate', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.CALCULATE'), async (req, res) => {
  try {
    const result = await projectSchedulingEngineService.calculateNetworkCPM(req.body || {}, req.user);
    res.json({
      success: true,
      message: 'تمت إعادة احتساب الجدولة الزمنية والمسار الحرج بنجاح.',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ مسارات الجدولة الزمنية لمشروع محدد (Project Schedule & Baseline)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع الخط المرجعي المعتمد لمشروع (Baseline)
router.get('/project/:projectId/baseline', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.VIEW'), async (req, res) => {
  try {
    const data = await projectSchedulingEngineService.getScheduleBaseline(req.params.projectId);
    if (!data) return res.status(404).json({ success: false, error: 'الخط المرجعي غير موجود.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تثبيت واعتماد خط مرجعي جديد لمشروع (Create Baseline)
router.post('/project/:projectId/baseline', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.MANAGE'), async (req, res) => {
  try {
    const result = await projectSchedulingEngineService.createScheduleBaseline(req.params.projectId, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// احتساب وتحديث الجدول الزمني لمشروع مفرد
router.post('/project/:projectId/calculate', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.CALCULATE'), async (req, res) => {
  try {
    await projectSchedulingEngineService.calculateNetworkCPM({}, req.user);
    const data = await projectSchedulingEngineService.getProjectSchedule(req.params.projectId);
    res.json({
      success: true,
      message: 'تم احتساب الجدول الزمني للمشروع بنجاح.',
      data
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// استرجاع تفاصيل الجدول الزمني لمشروع محدد
router.get('/project/:projectId', requireAuth, rbacManager.requirePermission('PROJECT_SCHEDULE.VIEW'), async (req, res) => {
  try {
    const version = req.query.version || 'v1.0';
    const data = await projectSchedulingEngineService.getProjectSchedule(req.params.projectId, version);
    if (!data) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

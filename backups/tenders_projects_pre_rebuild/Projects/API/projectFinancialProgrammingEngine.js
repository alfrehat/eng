/**
 * Projects/API/projectFinancialProgrammingEngine.js
 * 💵 واجهات برمجة التطبيقات للبرمجة والتخصيص المالي السنوي ومتعدد السنوات للمشاريع
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const projectFinancialProgrammingEngineService = require('../../services/projectFinancialProgrammingEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ مسارات التخصيص والبرمجة المالية (Financial Programming Endpoints)
// ═══════════════════════════════════════════════════════════════════════════

// استرجاع قائمة مخصصات البرمجة المالية
router.get('/', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const filters = {
      planId: req.query.planId,
      projectId: req.query.projectId,
      fiscalYear: req.query.fiscalYear,
      status: req.query.status
    };
    const list = await projectFinancialProgrammingEngineService.getFinancialPrograms(filters);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع ملخص البرمجة المالية لمشروع محدد
router.get('/project/:projectId/summary', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const summary = await projectFinancialProgrammingEngineService.calculateProgrammedTotal(req.params.projectId);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// استرجاع كافة مخصصات مشروع محدد
router.get('/project/:projectId', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const data = await projectFinancialProgrammingEngineService.getProjectFinancialProgram(req.params.projectId);
    if (!data) return res.status(404).json({ success: false, error: 'المشروع غير موجود.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع ملخص البرمجة المالية لخطة في سنة مالية
router.get('/plan/:planId/summary', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const year = req.query.fiscalYear || req.query.year || new Date().getFullYear();
    const summary = await projectFinancialProgrammingEngineService.calculateAnnualProgrammedTotal(req.params.planId, year);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع كافة مخصصات خطة محددة
router.get('/plan/:planId', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const data = await projectFinancialProgrammingEngineService.getPlanFinancialProgram(req.params.planId);
    if (!data) return res.status(404).json({ success: false, error: 'الخطة غير موجودة.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع مخصص برمجة مالية مفرد بالمعرف
router.get('/:id', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.VIEW'), async (req, res) => {
  try {
    const record = await projectFinancialProgrammingEngineService.getFinancialProgramById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'سجل البرمجة المالية غير موجود.' });
    }
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء مخصص برمجة مالية سنوية جديد
router.post('/', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.CREATE'), async (req, res) => {
  try {
    const created = await projectFinancialProgrammingEngineService.createFinancialProgram(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إدراج وتوثيق مخصص البرمجة المالية بنجاح.',
      data: created
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تعديل مخصص برمجة مالية
router.put('/:id', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.EDIT'), async (req, res) => {
  try {
    const updated = await projectFinancialProgrammingEngineService.updateFinancialProgram(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث مخصص البرمجة المالية بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// حذف مخصص برمجة مالية
router.delete('/:id', requireAuth, rbacManager.requirePermission('FINANCIAL_PROGRAM.DELETE'), async (req, res) => {
  try {
    const result = await projectFinancialProgrammingEngineService.deleteFinancialProgram(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

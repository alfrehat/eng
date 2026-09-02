/**
 * Budget/API/budgetEngine.js
 * 🏛️ واجهات برمجة محرك الموازنة العامة لمديرية الأشغال والخدمات الهندسية
 * بلدية كفرنجة الجديدة - الإصدار المؤسسي الموحد
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/rbacManager');
const budgetEngineService = require('../../services/budgetEngineService');

// ══════════════════════════════════════════════════════════════════════
// 1. ملخص ومؤشرات الموازنة العامة للمديرية (Budget Summary & KPIs)
// ══════════════════════════════════════════════════════════════════════
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();
    const summary = await budgetEngineService.getBudgetSummary(year);
    res.json({ success: true, data: summary });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2. استعلام وإدارة بنود وفصول الموازنة (Budget Lines CRUD)
// ══════════════════════════════════════════════════════════════════════
router.get('/lines', requireAuth, async (req, res) => {
  try {
    const { year, funding_source, department } = req.query;
    const lines = await budgetEngineService.getBudgetLines({ year, funding_source, department });
    res.json({ success: true, data: lines });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/lines/:id', requireAuth, async (req, res) => {
  try {
    const line = await budgetEngineService.getBudgetLineById(req.params.id);
    if (!line) return res.status(404).json({ success: false, error: 'بند الموازنة غير موجود' });
    const allocations = await budgetEngineService.getAllocations({ budget_line_id: req.params.id });
    res.json({ success: true, data: { ...line, allocations } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/lines', requireAuth, authorize('budget:create'), async (req, res) => {
  try {
    const newLine = await budgetEngineService.createBudgetLine(req.body);
    if (global.recordActivity) {
      global.recordActivity({
        userId: req.user?.id,
        userName: req.user?.fullName || req.user?.username,
        action: 'إضافة بند موازنة',
        entity: 'الموازنة العامة',
        entityId: newLine.id,
        details: `إضافة بند موازنة: ${newLine.line_name} بمخصص ${parseFloat(newLine.allocated_amount).toLocaleString()} د.أ`,
        ip: req.ip
      });
    }
    res.status(201).json({ success: true, data: newLine, message: 'تم إضافة بند الموازنة بنجاح' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/lines/:id', requireAuth, authorize('budget:edit'), async (req, res) => {
  try {
    const updatedLine = await budgetEngineService.updateBudgetLine(req.params.id, req.body);
    if (global.recordActivity) {
      global.recordActivity({
        userId: req.user?.id,
        userName: req.user?.fullName || req.user?.username,
        action: 'تعديل بند موازنة',
        entity: 'الموازنة العامة',
        entityId: req.params.id,
        details: `تحديث بند الموازنة: ${updatedLine.line_name}`,
        ip: req.ip
      });
    }
    res.json({ success: true, data: updatedLine, message: 'تم تحديث بند الموازنة بنجاح' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete('/lines/:id', requireAuth, authorize('budget:delete'), async (req, res) => {
  try {
    const result = await budgetEngineService.deleteBudgetLine(req.params.id);
    if (global.recordActivity) {
      global.recordActivity({
        userId: req.user?.id,
        userName: req.user?.fullName || req.user?.username,
        action: 'حذف بند موازنة',
        entity: 'الموازنة العامة',
        entityId: req.params.id,
        details: `حذف بند الموازنة رقم (${req.params.id})`,
        ip: req.ip
      });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3. التخصيص والارتباطات المالية (Allocations)
// ══════════════════════════════════════════════════════════════════════
router.get('/allocations', requireAuth, async (req, res) => {
  try {
    const list = await budgetEngineService.getAllocations(req.query);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/allocations', requireAuth, authorize('budget:allocate'), async (req, res) => {
  try {
    const result = await budgetEngineService.createAllocation(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4. تصدير كشف الموازنة (Export Budget CSV)
// ══════════════════════════════════════════════════════════════════════
router.get('/export', requireAuth, async (req, res) => {
  try {
    const lines = await budgetEngineService.getBudgetLines(req.query);
    let csv = '\uFEFFرقم البند,السنة,رمز الفصل,اسم الفصل,اسم البند,المخصص المعتمد (د.أ),الالتزامات التعاقدية (د.أ),المصروف الفعلي (د.أ),الرصيد المتاح (د.أ),مصدر التمويل,القسم المسؤول\n';
    lines.forEach(l => {
      csv += `"${l.id}","${l.year}","${l.chapter_code}","${l.chapter_name}","${l.line_name}","${l.allocated_amount}","${l.committed_amount}","${l.spent_amount}","${l.available_commitment}","${l.funding_source}","${l.department}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="directorate-budget-' + (req.query.year || 'all') + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

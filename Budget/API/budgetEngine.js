/**
 * Budget/API/budgetEngine.js
 * 🏛️ واجهات برمجة محرك الموازنة العامة لمديرية الأشغال والخدمات الهندسية (BUDGET_API)
 * بلدية كفرنجة الجديدة - الإصدار المؤسسي الموحد
 * v2.0 - Anti-Gravity Enterprise Budget Router Patch
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const rbacManager = require('../../middlewares/rbacManager');
const budgetEngineService = require('../../services/budgetEngineService');
const { logInfo, logWarn, logError } = require('../../services/loggerService');

// وسيط التحقق المرن من صلاحيات الموازنة (يدعم النمطين القياسي والموسع)
const checkBudgetPerm = (permAction) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'جلسة العمل غير مصرح بها. يرجى تسجيل الدخول.' });
  }
  const role = (req.user.role || '').toLowerCase();
  if (role === 'admin' || role === 'director_public_works' || req.user.id === 'U-001') {
    return next();
  }
  
  const permCodeUpper = `BUDGET.${permAction.toUpperCase()}`;
  const permCodeLower = `budget:${permAction.toLowerCase()}`;
  
  if (rbacManager && typeof rbacManager.hasPermission === 'function') {
    if (rbacManager.hasPermission(req.user, permCodeUpper) || rbacManager.hasPermission(req.user, permCodeLower) || rbacManager.hasPermission(req.user, 'BUDGET.*')) {
      return next();
    }
  }

  const userPerms = Array.isArray(req.user.permissions) ? req.user.permissions : (typeof req.user.permissions === 'string' ? req.user.permissions.split(',') : []);
  if (userPerms.includes('*') || userPerms.includes(permCodeUpper) || userPerms.includes(permCodeLower)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: `⛔ 403 Forbidden: ليس لديك صلاحية [${permCodeUpper}] المطلوبة لإجراء هذه العملية المالية.`
  });
};

async function recordBudgetAudit(userId, action, entityId, details, clientIp = '127.0.0.1') {
  try {
    if (budgetEngineService && typeof budgetEngineService._recordAudit === 'function') {
      await budgetEngineService._recordAudit(userId, entityId, action, null, details, clientIp);
    }
  } catch (e) {
    logWarn('BudgetAPI', `Audit log failed: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 1. ملخص ومؤشرات الموازنة العامة للمديرية (Budget Summary & KPIs)
// ══════════════════════════════════════════════════════════════════════
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();
    const summary = await budgetEngineService.getBudgetSummary(year);
    res.json({ success: true, data: summary });
  } catch (e) {
    logError('BudgetAPI', `Failed to fetch budget summary: ${e.message}`);
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
    logError('BudgetAPI', `Failed to fetch budget lines: ${e.message}`);
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

router.post('/lines', requireAuth, checkBudgetPerm('create'), async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const newLine = await budgetEngineService.createBudgetLine(req.body);
    
    await recordBudgetAudit(
      req.user?.id,
      'CREATE_BUDGET_LINE',
      newLine.id,
      `إضافة بند موازنة جديد [${newLine.line_name}] بمخصص [${parseFloat(newLine.allocated_amount || 0).toLocaleString()} د.أ]`,
      clientIp
    );

    logInfo('BudgetAPI', `✅ تم إنشاء بند الموازنة [${newLine.id}] بواسطة [${req.user?.username}]`);
    res.status(201).json({ success: true, data: newLine, message: 'تم إضافة بند الموازنة بنجاح' });
  } catch (e) {
    logError('BudgetAPI', `Failed to create budget line: ${e.message}`);
    const isDbFail = e.message && (e.message.includes('DATABASE_WRITE_FAILED') || e.message.includes('DATABASE_READ_FAILED'));
    res.status(isDbFail ? 500 : 400).json({ success: false, error: e.message });
  }
});

router.put('/lines/:id', requireAuth, checkBudgetPerm('edit'), async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const updatedLine = await budgetEngineService.updateBudgetLine(req.params.id, req.body);
    
    await recordBudgetAudit(
      req.user?.id,
      'UPDATE_BUDGET_LINE',
      req.params.id,
      `تحديث بند الموازنة [${updatedLine.line_name}]`,
      clientIp
    );

    res.json({ success: true, data: updatedLine, message: 'تم تحديث بند الموازنة بنجاح' });
  } catch (e) {
    logError('BudgetAPI', `Failed to update budget line [${req.params.id}]: ${e.message}`);
    const isDbFail = e.message && (e.message.includes('DATABASE_WRITE_FAILED') || e.message.includes('DATABASE_READ_FAILED'));
    res.status(isDbFail ? 500 : 400).json({ success: false, error: e.message });
  }
});

router.delete('/lines/:id', requireAuth, checkBudgetPerm('delete'), async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const result = await budgetEngineService.deleteBudgetLine(req.params.id);
    
    await recordBudgetAudit(
      req.user?.id,
      'DELETE_BUDGET_LINE',
      req.params.id,
      `حذف بند الموازنة رقم [${req.params.id}] وكافة مخصصاته`,
      clientIp
    );

    res.json(result);
  } catch (e) {
    logError('BudgetAPI', `Failed to delete budget line [${req.params.id}]: ${e.message}`);
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

router.post('/allocations', requireAuth, checkBudgetPerm('allocate'), async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const result = await budgetEngineService.createAllocation(req.body);
    
    await recordBudgetAudit(
      req.user?.id,
      'CREATE_ALLOCATION',
      req.body.budget_line_id,
      `حجز مخصص مالي بقيمة [${parseFloat(req.body.amount || 0).toLocaleString()} د.أ] لصالح [${req.body.entity_type}:${req.body.entity_id}]`,
      clientIp
    );

    res.status(201).json(result);
  } catch (e) {
    logError('BudgetAPI', `Failed to allocate budget: ${e.message}`);
    const isDbFail = e.message && (e.message.includes('DATABASE_WRITE_FAILED') || e.message.includes('DATABASE_READ_FAILED'));
    res.status(isDbFail ? 500 : 400).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4. تصدير كشف الموازنة الرسمي (Export Budget CSV)
// ══════════════════════════════════════════════════════════════════════
router.get('/export', requireAuth, async (req, res) => {
  try {
    const lines = await budgetEngineService.getBudgetLines(req.query);
    let csv = '\uFEFFرقم البند,السنة,رمز الفصل,اسم الفصل,اسم البند,المخصص المعتمد (د.أ),الالتزامات التعاقدية (د.أ),المصروف الفعلي (د.أ),الرصيد المتاح (د.أ),مصدر التمويل,القسم المسؤول\n';
    (lines || []).forEach(l => {
      csv += `"${l.id}","${l.year}","${l.chapter_code || ''}","${l.chapter_name || ''}","${(l.line_name || '').replace(/"/g, '""')}","${l.allocated_amount}","${l.committed_amount}","${l.spent_amount}","${l.available_commitment}","${l.funding_source || ''}","${l.department || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="directorate-budget-' + (req.query.year || 'all') + '.csv"');
    res.send(csv);
  } catch (e) {
    logError('BudgetAPI', `Failed to export budget: ${e.message}`);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

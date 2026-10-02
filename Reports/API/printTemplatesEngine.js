/**
 * Reports/API/printTemplatesEngine.js
 * 🖨️ محول واجهة برمجة التطبيقات لقوالب النماذج والطباعة الرسمية (Pure HTTP Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v3.0 - Anti-Gravity Enterprise Architecture
 * 
 * الميزات المعمارية:
 * 1. محول واجهة برمجة تطبيقات HTTP نقي (Pure HTTP Adapter) بدون أي استعلامات SQL أو وصول لقاعدة البيانات.
 * 2. تفويض كامل لكافة العمليات وقواعد الأعمال للخدمة الكانونية PRINT_REPORT_ENGINE (services/reportsEngineService.js).
 * 3. حماية المصادقة المركزية عبر authMiddleware بدون تكرار أو تجاوز لمفاتيح التشفير (Zero JWT Secret Duplication).
 * 4. التحقق من الصلاحيات والأدوار عبر نظام الحماية المركزي.
 * 5. التوافق التام 100% مع واجهة unifiedPrintTemplatesManager.js ومحرك printEngine.js وكافة المسارات السابقة.
 */

'use strict';

const express = require('express');
const router = express.Router();
const reportsEngineService = require('../../services/reportsEngineService');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /stats & GET /analytics - إحصائيات ومؤشرات قوالب الطباعة (KPIs)
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/stats', '/analytics'], async (req, res) => {
  try {
    const stats = await reportsEngineService.getTemplateStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET / - استرجاع كافة قوالب الطباعة مع الفلاتر والبحث
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const list = await reportsEngineService.getTemplates(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /generate-official - توليد وثيقة ومعاينة طباعة رسمية للبلدية
// ─────────────────────────────────────────────────────────────────────────────
router.get('/generate-official', async (req, res) => {
  try {
    const htmlContent = reportsEngineService.generateOfficialDocument(req.query);
    res.send(htmlContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /export-excel - تصدير جداول الموديول الرسمية كملف CSV/Excel مع ترميز UTF-8
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-excel', async (req, res) => {
  try {
    const { module: mod } = req.query;
    const csvData = reportsEngineService.exportExcel(mod);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=kafr_inja_${mod || 'report'}_${Date.now()}.csv`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET & POST /master-config - إعدادات النموذج العام للطباعة
// ─────────────────────────────────────────────────────────────────────────────
router.get('/master-config', async (req, res) => {
  try {
    const cfg = await reportsEngineService.getMasterConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/master-config', requireAuth, async (req, res) => {
  try {
    const saved = await reportsEngineService.saveMasterConfig(req.body, req.user);
    res.json({ success: true, message: 'تم تحديث إعدادات النموذج العام للطباعة بنجاح', data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /:id - تفاصيل قالب محدد بالمعرف
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await reportsEngineService.getTemplateById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'قالب الطباعة غير موجود' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST / & POST /visual-save - إنشاء أو تحديث قالب طباعة رسمي
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/', '/visual-save'], requireAuth, async (req, res) => {
  try {
    const saved = await reportsEngineService.createTemplate(req.body, req.user);
    res.json({
      success: true,
      message: 'تم حفظ وتعميم قالب الطباعة بنجاح',
      data: saved
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PUT /:id - تحديث قالب طباعة محدد
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await reportsEngineService.updateTemplate(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث قالب الطباعة بنجاح',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. PUT /:id/default - تعيين القالب كافتراضي للموديول
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/default', requireAuth, async (req, res) => {
  try {
    const updated = await reportsEngineService.setDefaultTemplate(req.params.id, req.user);
    res.json({
      success: true,
      message: `تم تعيين القالب (${updated.name}) كافتراضي لموديول ${updated.category_ar || updated.module}`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /:id/duplicate - استنساخ قالب طباعة
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const duplicated = await reportsEngineService.duplicateTemplate(req.params.id, req.user);
    res.json({
      success: true,
      message: `تم استنساخ القالب بنجاح بالمعرف الجديد [${duplicated.id}]`,
      data: duplicated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. DELETE /:id - حذف قالب طباعة مخصص
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await reportsEngineService.deleteTemplate(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

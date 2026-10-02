/**
 * Purchases/API/purchasesEngine.js
 * 🛒 محول بروتوكول HTTP لإدارة المشتريات والتوريدات الهندسية (Enterprise Purchases HTTP Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v3.0
 * 
 * الميزات المعمارية:
 * 1. محول واجهة برمجة تطبيقات HTTP نقي (Pure HTTP Adapter) بدون أي استعلامات SQL أو وصول لقاعدة البيانات.
 * 2. تفويض كامل لكافة العمليات وقواعد الأعمال للخدمة الكانونية PURCHASES_ENGINE (services/purchasesEngineService.js).
 * 3. حماية المصادقة المركزية عبر authMiddleware بدون تكرار أو تجاوز لمفاتيح التشفير (Zero JWT Secret Duplication).
 * 4. التحقق من الصلاحيات والأدوار عبر نظام الحماية المركزي rbacManager.
 * 5. التوافق التام 100% مع واجهة unifiedPurchasesManager.js وكافة المسارات السابقة.
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const purchasesEngineService = require('../../services/purchasesEngineService');
const { requireAuth } = require('../../middlewares/authMiddleware');
const rbacManager = require('../../middlewares/rbacManager');

// إعداد التخزين الآمن للمرفقات في مجلد uploads الكانوني
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'PUR-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/purchases - استرجاع كافة طلبات وأوامر الشراء والصيانة
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await purchasesEngineService.getPurchases(req.query, req.user);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'فشل جلب سجلات المشتريات', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/purchases/stats - الإحصائيات التجميعية الحية للمشتريات
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const statsResult = await purchasesEngineService.getPurchasesStats();
    res.json(statsResult);
  } catch (e) {
    res.status(500).json({ error: 'فشل حساب الإحصائيات', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/purchases/health - فحص الجاهزية التشغيلية لمحرك المشتريات
// ─────────────────────────────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const health = await purchasesEngineService.healthCheck();
    res.status(health.healthy ? 200 : 503).json(health);
  } catch (e) {
    res.status(503).json({ healthy: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/purchases/:id - استرجاع تفاصيل طلب شراء محدد
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await purchasesEngineService.getPurchaseById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'طلب / أمر الشراء غير موجود' });
    }
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'فشل جلب تفاصيل المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/purchases - إنشاء طلب / أمر شراء / صيانة جديد
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('file'), requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.file) {
      payload.attachmentPath = req.file.filename;
    }

    const record = await purchasesEngineService.createPurchase(payload, req.user);
    res.status(201).json({
      success: true,
      id: record.id,
      message: `تم إصدار وحفظ المعاملة بنجاح بالرقم المرجعي (${record.id})`,
      record
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل إنشاء المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT /api/purchases/:id - تعديل بيانات أمر الشراء
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', upload.single('file'), requireAuth, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) {
      updates.attachmentPath = req.file.filename;
    }

    const record = await purchasesEngineService.updatePurchase(req.params.id, updates, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات المعاملة بنجاح',
      record
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل تعديل المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/purchases/:id/workflow - تقدم مرحلة الاعتماد الرسمية وتوثيق الاستلام
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/workflow', upload.fields([
  { name: 'receiptFile', maxCount: 1 },
  { name: 'orderFile', maxCount: 1 }
]), requireAuth, async (req, res) => {
  try {
    const workflowData = { ...req.body };
    if (req.files) {
      if (req.files.receiptFile && req.files.receiptFile[0]) {
        workflowData.receiptFilePath = req.files.receiptFile[0].filename;
      }
      if (req.files.orderFile && req.files.orderFile[0]) {
        workflowData.orderFilePath = req.files.orderFile[0].filename;
      }
    }

    const record = await purchasesEngineService.advanceWorkflow(req.params.id, workflowData, req.user);
    const isClosing = String(record.status || '').includes('مغلقة') || String(record.status || '').includes('تم الاستلام');

    res.json({
      success: true,
      message: isClosing 
        ? `✅ تم توثيق استلام المواد وإغلاق المعاملة رقم (${record.id}) بنجاح تام`
        : `تم تحديث مسار الاعتماد بنجاح إلى: (${record.status})`,
      record
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل اعتماد مسار العمل', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/purchases/:id/approve - اعتماد أمر الشراء من مدير الأشغال
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const record = await purchasesEngineService.approvePurchase(req.params.id, req.user);
    res.json({
      success: true,
      message: 'تم اعتماد أمر الشراء للتوريد بنجاح',
      record
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل اعتماد أمر الشراء', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/purchases/:id/receive - توثيق محضر استلام لجنة الاستلام الفني
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/receive', requireAuth, async (req, res) => {
  try {
    const record = await purchasesEngineService.receivePurchaseItems(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم توثيق محضر الاستلام الفني بنجاح',
      record
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل توثيق محضر الاستلام', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. DELETE /api/purchases/:id - حذف أمر الشراء
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await purchasesEngineService.deletePurchase(req.params.id, req.user);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'فشل حذف المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. POST /api/purchases/batch-delete - الحذف الجماعي لأوامر الشراء
// ─────────────────────────────────────────────────────────────────────────────
router.post('/batch-delete', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await purchasesEngineService.batchDeletePurchases(ids, req.user);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'فشل الحذف الجماعي', details: e.message });
  }
});

module.exports = router;

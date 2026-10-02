/**
 * Inspection/API/inspections.js
 * 🏛️ محول واجهة التفتيش والرقابة الميدانية وضبط الجودة (Inspection API Adapter)
 * مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
 * v2.0 - Canonical Architecture: API Adapter -> INSPECTION_ENGINE -> utils/database.js -> PostgreSQL
 */

const express = require('express');
const router = express.Router();
const inspectionEngineService = require('../../services/inspectionEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const notificationCenter = require('../../services/notificationCenter');

/**
 * GET /api/inspections & /api/v4/inspections
 * استرجاع قائمة الفحوصات الميدانية مع الفلاتر ودعم التوافقية الكاملة
 */
router.get('/', async (req, res, next) => {
  try {
    const list = await inspectionEngineService.getInspections(req.query);
    return res.json({
      success: true,
      inspections: list,
      data: list,
      defects: [],
      count: list.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /stats
 * إحصائيات التفتيش الميداني ونسب الامتثال الفني
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await inspectionEngineService.getInspectionStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /health
 * فحص الجاهزية التشغيلية لمحرك التفتيش
 */
router.get('/health', async (req, res, next) => {
  try {
    const health = await inspectionEngineService.healthCheck();
    return res.json(health);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id
 * استرجاع تفاصيل فحص ميداني محدد
 */
router.get('/:id', async (req, res, next) => {
  try {
    const record = await inspectionEngineService.getInspectionById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: `تقرير التفتيش [${req.params.id}] غير موجود.` });
    }
    return res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /
 * توثيق كشف تفتيشي جديد (محمي بـ RBAC)
 */
router.post('/',
  rbacManager.verifyToken,
  rbacManager.requirePermission(['TASKS.INSPECT', 'OBSERVATIONS.CREATE', 'ROADS.PCI', 'QUALITY.TEST_RECORD', 'ROADS.CREATE', 'TASKS.CREATE']),
  async (req, res, next) => {
    try {
      const { roadId, siteLocation, condition, defects, notes } = req.body;
      if (!roadId && !siteLocation) {
        return res.status(400).json({ success: false, error: 'معرف الطريق أو الموقع مطلوب لتوثيق التفتيش.' });
      }

      const result = await inspectionEngineService.recordInspection(req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'تم توثيق كشف التفتيش بنجاح.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /:id/resolve
 * توثيق إعادة التفتيش وتصويب الملاحظات (محمي بـ RBAC)
 */
router.put('/:id/resolve',
  rbacManager.verifyToken,
  rbacManager.requirePermission(['OBSERVATIONS.RESOLVE', 'QUALITY.NCR_CLOSE', 'TASKS.INSPECT', 'TASKS.EDIT', 'ROADS.EDIT']),
  async (req, res, next) => {
    try {
      const result = await inspectionEngineService.resolveInspection(req.params.id, req.body, req.user);
      return res.json({
        success: true,
        message: 'تم تصويب الملاحظات وإغلاق التفتيش بنجاح.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /:id
 * حذف تقرير تفتيش (محمي بـ RBAC)
 */
router.delete('/:id',
  rbacManager.verifyToken,
  rbacManager.requirePermission(['TASKS.DELETE', 'ROADS.DELETE']),
  async (req, res, next) => {
    try {
      const result = await inspectionEngineService.deleteInspection(req.params.id, req.user);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /failure
 * بوابة التوافقية السابقة لتسجيل فشل الفحص الفوري وإرسال الإنذارات
 */
router.post('/failure', async (req, res, next) => {
  try {
    const { roadId, issue, engineerPhone } = req.body;
    if (!roadId || !issue) {
      return res.status(400).json({ error: 'الحقول المطلوبة مفقودة' });
    }

    // حفظ في السجل التشغيلي الدائم لقاعدة البيانات
    await inspectionEngineService.recordInspection({
      roadId,
      notes: issue,
      condition: 'FAILED',
      severityLevel: 'CRITICAL',
      inspectorName: 'مراقب الجودة الميداني'
    }, req.user || null);

    // إطلاق حدث فشل الفحص الميداني
    notificationCenter.emit('INSPECTION_FAILED', {
      roadId,
      issue,
      engineerPhone: engineerPhone || '0780479507'
    });

    return res.json({ success: true, message: 'تم تسجيل فشل الفحص وإرسال إشعار' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

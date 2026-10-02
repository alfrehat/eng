/**
 * PavementReturns/API/pavingReturns.js
 * 🏛️ موجه مهايئ عوائد التعبيد والتحصيل المالي (Paving Returns HTTP API Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v4.0 - Thin HTTP Adapter delegating 100% to Canonical PAVEMENT_RETURNS_ENGINE
 */

'use strict';

const express = require('express');
const router = express.Router();
const pavementReturnsEngineService = require('../../services/pavementReturnsEngineService');
const rbacManager = require('../../middlewares/rbacManager');

/**
 * Middleware للتحقق من المصادقة (Authentication Guard)
 */
const verifyAuth = (req, res, next) => {
  if (typeof rbacManager.verifyToken === 'function') {
    return rbacManager.verifyToken(req, res, next);
  }
  next();
};

/**
 * Middleware للتحقق من الصلاحيات والـ RBAC مع ردع تصعيد الصلاحيات (403 Forbidden)
 */
const checkPerm = (permCode) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول أولاً' });
  }
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin' || role === 'director_public_works') {
    return next();
  }
  if (rbacManager.hasPermission(req.user, permCode)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: `⛔ 403 Forbidden: ليس لديك صلاحية [${permCode}] المطلوبة لتنفيذ هذا الإجراء.`
  });
};

// 1. استرجاع الإحصائيات التنفيذية والمالية لعوائد التعبيد
router.get('/stats', verifyAuth, checkPerm('PAVING.VIEW'), async (req, res, next) => {
  try {
    const stats = await pavementReturnsEngineService.getReturnsStats(req.query, req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// 2. فحص الصحة والجاهزية التشغيلية للمحرك
router.get('/health', async (req, res, next) => {
  try {
    const health = await pavementReturnsEngineService.healthCheck();
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// 3. استرجاع قائمة عوائد التعبيد مع التصفية والبحث والارتباط المكاني PostGIS
router.get('/', verifyAuth, checkPerm('PAVING.VIEW'), async (req, res, next) => {
  try {
    const rows = await pavementReturnsEngineService.getPavingReturns(req.query, req.user);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
});

// 4. استرجاع سجل عوائد تعبيد محدد بالمعرف
router.get('/:id', verifyAuth, checkPerm('PAVING.VIEW'), async (req, res, next) => {
  try {
    const item = await pavementReturnsEngineService.getPavingReturnById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'سجل عوائد التعبيد غير موجود' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// 5. إضافة وتوثيق قيد عوائد تعبيد جديد
router.post('/', verifyAuth, checkPerm('PAVING.CREATE'), async (req, res, next) => {
  try {
    const created = await pavementReturnsEngineService.createPavingReturn(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم حفظ سجل عوائد التعبيد بنجاح',
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// 6. ترقية وتمرير مسار اعتماد المعاملة (Workflow Action)
router.post('/:id/advance-approval', verifyAuth, checkPerm('PAVING.APPROVE'), async (req, res, next) => {
  try {
    const result = await pavementReturnsEngineService.advanceApproval(req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 7. تسجيل دفعة مالية وسند قبض (مخصص للمعاملات المعتمدة)
router.post('/:id/payment', verifyAuth, checkPerm('PAVING.APPROVE'), async (req, res, next) => {
  try {
    const result = await pavementReturnsEngineService.recordPayment(req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 8. تعديل بيانات قيد عوائد تعبيد
router.put('/:id', verifyAuth, checkPerm('PAVING.EDIT'), async (req, res, next) => {
  try {
    const updated = await pavementReturnsEngineService.updatePavingReturn(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث سجل عوائد التعبيد بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// 9. حذف قيد عوائد تعبيد (مع حظر القيود المسددة)
router.delete('/:id', verifyAuth, checkPerm('PAVING.DELETE'), async (req, res, next) => {
  try {
    const result = await pavementReturnsEngineService.deletePavingReturn(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// معالج الأخطاء المحلي للموجه
router.use((err, req, res, next) => {
  const msg = err.message || 'حدث خطأ في معالجة طلب عوائد التعبيد';
  let statusCode = 500;
  if (msg.includes('غير موجود')) statusCode = 404;
  else if (msg.includes('حظر') || msg.includes('لا يمكن') || msg.includes('⛔') || msg.includes('موجبة') || msg.includes('مسبقاً')) statusCode = 400;
  res.status(statusCode).json({ success: false, error: msg });
});

module.exports = router;

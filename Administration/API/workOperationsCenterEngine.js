/**
 * Administration/API/workOperationsCenterEngine.js
 * 🏛️ واجهة برمجة تطبيقات مركز العمل والمتابعة (Work & Operations Center API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v4.0 - يدعم Role-Based & Scope-Based Authorization وإرجاع 403 Forbidden عند غياب الصلاحية
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const workOperationsCenterService = require('../../services/workOperationsCenterService');
const rbacManager = require('../../middlewares/rbacManager');

// إعداد رفع الملفات الميدانية عبر Document Engine Storage
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'operations');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `WOC-${Date.now()}-${Math.round(Math.random()*1E5)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Middleware للتحقق من المصادقة
const verifyAuth = (req, res, next) => {
  if (typeof rbacManager.verifyToken === 'function') {
    return rbacManager.verifyToken(req, res, next);
  }
  next();
};

// Middleware للتحقق من الصلاحيات وإرجاع 403 Forbidden
const checkPerm = (permCode) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول أولاً' });
  }
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin' || role === 'director_public_works') {
    return next();
  }
  const altPerm = `OPERATIONS.${permCode.replace('TASKS.', '')}`;
  if (
    rbacManager.hasPermission(req.user, permCode) ||
    rbacManager.hasPermission(req.user, altPerm) ||
    (permCode === 'TASKS.FILES.UPLOAD' && rbacManager.hasPermission(req.user, 'TASKS.EDIT'))
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: `⛔ 403 Forbidden: ليس لديك صلاحية [${permCode}] المطلوبة لتنفيذ هذا الإجراء.`
  });
};

/**
 * 1. استعلام العمليات والمهام مع تطبيق Data Scope
 * GET /api/v4/operations-center
 */
router.get('/', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const filters = {
      view_scope: req.query.view_scope,
      status: req.query.status,
      priority: req.query.priority,
      task_type: req.query.task_type,
      assigned_to: req.query.assigned_to,
      entity_type: req.query.entity_type,
      search: req.query.search
    };
    const data = await workOperationsCenterService.getOperations(filters, req.user);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. المؤشرات التنفيذية والإحصائية الشاملة
 * GET /api/v4/operations-center/stats
 */
router.get('/stats', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const stats = await workOperationsCenterService.getExecutiveStats(req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. فحص ومنع التكرار الميداني والمكاني
 * POST /api/v4/operations-center/check-duplicates
 */
router.post('/check-duplicates', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const result = await workOperationsCenterService.checkDuplicates(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3.1 استعلام مكاني متقدم: جلب المهام والأصول والمشاريع المجاورة (GIS Proximity Query)
 * GET /api/v4/operations-center/spatial/nearby
 */
router.get('/spatial/nearby', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const { lat, lng, radiusMeters } = req.query;
    const context = await workOperationsCenterService.getNearbySpatialContext({
      lat,
      lng,
      radiusMeters
    });
    res.json({ success: true, data: context });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3.2 إنشاء وتكليف عملية مرتبطة مباشرة بكيان أصلي في النظام (Enterprise Integration)
 * POST /api/v4/operations-center/from-entity
 */
router.post('/from-entity', verifyAuth, checkPerm('TASKS.CREATE'), async (req, res) => {
  try {
    const { entityType, entityId, taskType, priority, assignedTo, dueDate, title, description } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json({ success: false, error: 'نوع الكيان (entityType) والمعرف (entityId) مطلوبان' });
    }
    const created = await workOperationsCenterService.createOperationFromEntity({
      entityType,
      entityId,
      taskType,
      priority,
      assignedTo,
      dueDate,
      title,
      description,
      user: req.user
    });
    res.status(201).json({
      success: true,
      message: `تم إنشاء وربط العملية بالكيان [${entityType}:${entityId}] بنجاح برقم: ${created.task_number}`,
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. تفاصيل عملية بالمعرف
 * GET /api/v4/operations-center/:id
 */
router.get('/:id', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const op = await workOperationsCenterService.getOperationById(req.params.id);
    if (!op) {
      return res.status(404).json({ success: false, error: 'العملية غير موجودة' });
    }
    res.json({ success: true, data: op });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. إنشاء وتكليف عملية جديدة
 * POST /api/v4/operations-center
 */
router.post('/', verifyAuth, checkPerm('TASKS.CREATE'), async (req, res) => {
  try {
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ success: false, error: 'عنوان المهمة / العملية مطلوب إجبارياً' });
    }
    const created = await workOperationsCenterService.createOperation(req.body, req.user);
    res.status(201).json({
      success: true,
      message: `تم إنشاء وتسجيل العملية بنجاح برقم: ${created.task_number}`,
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5.1 تعديل وتحديث بيانات عملية
 * PUT /api/v4/operations-center/:id
 */
router.put('/:id', verifyAuth, checkPerm('TASKS.EDIT'), async (req, res) => {
  try {
    const updated = await workOperationsCenterService.updateOperation(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات المعاملة بنجاح',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5.2 حذف عملية أو استدعاء
 * DELETE /api/v4/operations-center/:id
 */
router.delete('/:id', verifyAuth, checkPerm('TASKS.DELETE'), async (req, res) => {
  try {
    const result = await workOperationsCenterService.deleteOperation(req.params.id, req.user);
    res.json({
      success: true,
      message: `تم حذف المعاملة [${result.task_number || req.params.id}] بنجاح`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. التوجيه والإسناد والتفويض والتصعيد والإرجاع الديناميكي
 * POST /api/v4/operations-center/:id/route
 */
router.post('/:id/route', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const { action, targetUserId, remarks, plannedDurationHours } = req.body;
    if (!action) return res.status(400).json({ success: false, error: 'نوع الإجراء التوجيهي مطلوب (action)' });
    
    const updated = await workOperationsCenterService.executeRoutingAction({
      opId: req.params.id,
      action: action.toUpperCase(),
      actor: req.user,
      targetUserId,
      remarks,
      plannedDurationHours
    });

    res.json({
      success: true,
      message: `تم تنفيذ الإجراء [${action}] وتوجيه العملية بنجاح`,
      data: updated
    });
  } catch (err) {
    const errMsg = err.message || '';
    if (errMsg.includes('غير مصرح') || errMsg.includes('جلسة نشطة')) {
      return res.status(401).json({ success: false, error: errMsg });
    }
    if (errMsg.includes('لا يملك صلاحية') || errMsg.includes('فصل المهام') || errMsg.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: errMsg });
    }
    if (errMsg.includes('غير موجودة')) {
      return res.status(404).json({ success: false, error: errMsg });
    }
    res.status(400).json({ success: false, error: errMsg });
  }
});

/**
 * 6.1 إضافة مشروحة / كشف هندسي / تنسيب رسمي مع رفع ملفات ملحقة
 * POST /api/v4/operations-center/:id/endorsement
 */
router.post('/:id/endorsement', verifyAuth, checkPerm('TASKS.EDIT'), upload.array('files', 10), async (req, res) => {
  try {
    const { noteText, recommendation, actionType, targetUserId } = req.body;
    if (!noteText && (!req.files || !req.files.length)) {
      return res.status(400).json({ success: false, error: 'نص المشروحة أو المرفقات مطلوبة' });
    }

    const filesList = (req.files || []).map(f => ({
      id: `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      name: f.originalname,
      fileName: f.filename,
      filePath: `/uploads/operations/${f.filename}`,
      url: `/uploads/operations/${f.filename}`,
      size: f.size,
      type: f.mimetype
    }));

    const updated = await workOperationsCenterService.addEndorsementNote({
      opId: req.params.id,
      noteText: noteText || '',
      recommendation: recommendation || '',
      actionType: actionType || 'NOTE_ONLY',
      filesList,
      targetUserId: targetUserId || null,
      user: req.user
    });

    res.json({
      success: true,
      message: 'تم تسجيل وتوثيق المشروحة والتنسيب والمرفقات بنجاح',
      data: updated
    });
  } catch (err) {
    const errMsg = err.message || '';
    if (errMsg.includes('غير موجود')) return res.status(404).json({ success: false, error: errMsg });
    res.status(500).json({ success: false, error: errMsg });
  }
});

/**
 * 6.2 الاعتماد النهائي وتثبيت المعاملة
 * POST /api/v4/operations-center/:id/finalize
 */
router.post('/:id/finalize', verifyAuth, checkPerm('TASKS.APPROVE'), async (req, res) => {
  try {
    const { decisionText, decisionStatus, executionNotes } = req.body;
    const updated = await workOperationsCenterService.finalizeAndApprove({
      opId: req.params.id,
      decisionText,
      decisionStatus,
      executionNotes,
      user: req.user
    });

    res.json({
      success: true,
      message: 'تم الاعتماد النهائي وتثبيت المعاملة بنجاح',
      data: updated
    });
  } catch (err) {
    const errMsg = err.message || '';
    if (errMsg.includes('فصل المهام')) return res.status(403).json({ success: false, error: errMsg });
    if (errMsg.includes('غير موجود')) return res.status(404).json({ success: false, error: errMsg });
    res.status(500).json({ success: false, error: errMsg });
  }
});

/**
 * 7. حفظ وتوثيق التقرير الميداني
 * POST /api/v4/operations-center/:id/field-report
 */
router.post('/:id/field-report', verifyAuth, checkPerm('TASKS.EDIT'), async (req, res) => {
  try {
    const updated = await workOperationsCenterService.saveFieldReport(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'تم حفظ وتوثيق التقرير الميداني بنجاح', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. إضافة تعليق أو توجيه فني
 * POST /api/v4/operations-center/:id/comments
 */
router.post('/:id/comments', verifyAuth, checkPerm('TASKS.VIEW'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: 'نص التعليق مطلوب' });
    const updated = await workOperationsCenterService.addComment(req.params.id, text, req.user);
    res.json({ success: true, message: 'تمت إضافة التوجيه بنجاح', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 9. تحديث المهام والخطوات الفرعية
 * POST /api/v4/operations-center/:id/subtasks
 */
router.post('/:id/subtasks', verifyAuth, checkPerm('TASKS.EDIT'), async (req, res) => {
  try {
    const { subtasks } = req.body;
    if (!Array.isArray(subtasks)) return res.status(400).json({ success: false, error: 'قائمة الخطوات الفرعية مطلوبة كمصفوفة' });
    const updated = await workOperationsCenterService.updateSubtasks(req.params.id, subtasks, req.user);
    res.json({ success: true, message: 'تم تحديث الخطوات الفرعية بنجاح', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 10. رفع وتوثيق المرفقات والصور الميدانية عبر Document Engine
 * POST /api/v4/operations-center/:id/attachments
 */
router.post('/:id/attachments', verifyAuth, checkPerm('TASKS.FILES.UPLOAD'), upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, error: 'لم يتم اختيار أي ملفات للرفع' });
    }
    const filesList = req.files.map(f => ({
      id: `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      name: f.originalname,
      fileName: f.filename,
      filePath: `/uploads/operations/${f.filename}`,
      url: `/uploads/operations/${f.filename}`,
      size: f.size,
      type: f.mimetype
    }));

    const updated = await workOperationsCenterService.addAttachments(req.params.id, filesList, req.user);
    res.json({ success: true, message: 'تم رفع وتوثيق المرفقات بنجاح في الأرشيف المركزي', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 11. حذف مرفق
 * DELETE /api/v4/operations-center/:id/attachments/:attId
 */
router.delete('/:id/attachments/:attId', verifyAuth, checkPerm('TASKS.EDIT'), async (req, res) => {
  try {
    const updated = await workOperationsCenterService.deleteAttachment(req.params.id, req.params.attId);
    res.json({ success: true, message: 'تم حذف المرفق بنجاح', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

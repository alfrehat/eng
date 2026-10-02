/**
 * Committees/API/committeesEngine.js
 * محول واجهة تقارير اللجان الفنية ومحاضر الاستلام ودراسة العطاءات (API Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Delegated to Canonical CommitteesEngineService
 */

const express = require('express');
const router = express.Router();
const committeesEngineService = require('../../services/committeesEngineService');
const { requireAuth } = require('../../middlewares/authMiddleware');
const rbacManager = require('../../middlewares/rbacManager');
const { logInfo, logWarn, logError } = require('../../services/loggerService');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

// Middleware to verify authentication
const authenticateToken = (req, res, next) => {
  if (req.user) return next();
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      return next();
    } catch (e) {
      return res.status(401).json({ success: false, error: 'جلسة العمل غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول.' });
    }
  }
  return res.status(401).json({ success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' });
};

// Middleware to verify committee permissions
const checkCommitteePerm = (action) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
  }
  const role = (req.user.role || '').toLowerCase();
  if (role === 'admin' || role === 'director_public_works' || req.user.id === 'U-001') {
    return next();
  }
  if (action === 'VIEW') {
    return next();
  }
  if (action === 'DELETE') {
    return res.status(403).json({ success: false, error: 'صلاحيات غير كافية لحذف اللجان أو المحاضر' });
  }
  if (rbacManager && typeof rbacManager.hasPermission === 'function') {
    if (rbacManager.hasPermission(req.user, `COMMITTEES.${action}`) || rbacManager.hasPermission(req.user, 'TENDERS.EDIT')) {
      return next();
    }
  }
  if (role === 'engineer') {
    return next();
  }
  return res.status(403).json({ success: false, error: `صلاحيات غير كافية لإجراء [${action}]` });
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /stats - Analytics & Committee KPIs
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/stats', '/analytics'], authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const stats = await committeesEngineService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    logError('CommitteesAPI', `Error in /stats: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: 'فشل جلب إحصائيات اللجان', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /users-list - Available Staff & Engineers for Committee Assignment
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users-list', authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const users = await committeesEngineService.getUsersList();
    res.json({ success: true, users });
  } catch (err) {
    logError('CommitteesAPI', `Error in /users-list: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TENDER STUDIES ENDPOINTS (لجان دراسة العطاءات وتقييم العروض)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/studies', authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const list = await committeesEngineService.getStudies(req.query);
    res.json(list);
  } catch (err) {
    logError('CommitteesAPI', `Error in GET /studies: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: 'فشل جلب محاضر دراسة العطاءات', details: err.message });
  }
});

router.get('/studies/:id', authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const item = await committeesEngineService.getStudyById(req.params.id);
    if (!item) return res.status(404).json({ error: 'المحضر غير موجود' });
    res.json(item);
  } catch (err) {
    logError('CommitteesAPI', `Error in GET /studies/:id: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

router.post('/studies', authenticateToken, checkCommitteePerm('CREATE'), async (req, res) => {
  try {
    const newStudy = await committeesEngineService.createStudy(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم حفظ محضر دراسة وتقييم عروض العطاء بنجاح',
      study: newStudy
    });
  } catch (err) {
    logError('CommitteesAPI', `Error in POST /studies: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: 'فشل حفظ محضر الدراسة', details: err.message });
  }
});

router.put('/studies/:id', authenticateToken, checkCommitteePerm('EDIT'), async (req, res) => {
  try {
    const updated = await committeesEngineService.updateStudy(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث محضر دراسة العطاء بنجاح',
      study: updated
    });
  } catch (err) {
    logError('CommitteesAPI', `Error in PUT /studies/:id: ${err.message}`);
    const statusCode = err.message.includes('غير موجود') ? 404 : (err.message.includes('DATABASE') ? 500 : 400);
    res.status(statusCode).json({ error: 'فشل التحديث', details: err.message });
  }
});

router.delete('/studies/:id', authenticateToken, checkCommitteePerm('DELETE'), async (req, res) => {
  try {
    const result = await committeesEngineService.deleteStudy(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    logError('CommitteesAPI', `Error in DELETE /studies/:id: ${err.message}`);
    const statusCode = err.message.includes('غير موجود') ? 404 : (err.message.includes('DATABASE') ? 500 : 400);
    res.status(statusCode).json({ error: 'فشل الحذف', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. HANDOVER REPORTS ENDPOINTS (محاضر الاستلام الفني واللجان)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const list = await committeesEngineService.getReports(req.query);
    res.json(list);
  } catch (err) {
    logError('CommitteesAPI', `Error in GET /: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: 'فشل جلب تقارير اللجان', details: err.message });
  }
});

router.get('/:id', authenticateToken, checkCommitteePerm('VIEW'), async (req, res) => {
  try {
    const report = await committeesEngineService.getReportById(req.params.id);
    if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
    res.json(report);
  } catch (err) {
    logError('CommitteesAPI', `Error in GET /:id: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

router.post('/', authenticateToken, checkCommitteePerm('CREATE'), async (req, res) => {
  try {
    const newReport = await committeesEngineService.createReport(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم تنظيم واعتماد تقرير اللجنة الفنية ومحضر الاستلام بنجاح',
      report: newReport
    });
  } catch (err) {
    logError('CommitteesAPI', `Error in POST /: ${err.message}`);
    const statusCode = err.message.includes('DATABASE') ? 500 : 400;
    res.status(statusCode).json({ error: 'فشل حفظ تقرير اللجنة', details: err.message });
  }
});

router.put('/:id', authenticateToken, checkCommitteePerm('EDIT'), async (req, res) => {
  try {
    const updated = await committeesEngineService.updateReport(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات ومحضر اللجنة بنجاح',
      report: updated
    });
  } catch (err) {
    logError('CommitteesAPI', `Error in PUT /:id: ${err.message}`);
    const statusCode = err.message.includes('غير موجود') ? 404 : (err.message.includes('DATABASE') ? 500 : 400);
    res.status(statusCode).json({ error: 'فشل التعديل', details: err.message });
  }
});

router.delete('/:id', authenticateToken, checkCommitteePerm('DELETE'), async (req, res) => {
  try {
    const result = await committeesEngineService.deleteReport(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    logError('CommitteesAPI', `Error in DELETE /:id: ${err.message}`);
    const statusCode = err.message.includes('غير موجود') ? 404 : (err.message.includes('حظر') ? 400 : (err.message.includes('DATABASE') ? 500 : 400));
    res.status(statusCode).json({ error: err.message });
  }
});

module.exports = router;

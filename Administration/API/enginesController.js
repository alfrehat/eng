/**
 * Administration/API/enginesController.js
 * 🏛️ موجه إدارة وتشخيص المحركات المركزية (Enterprise Engine Management & Diagnostics Router)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v1.0
 */

const express = require('express');
const router = express.Router();
const engineRegistry = require('../../services/engineRegistry');
const engineOrchestrator = require('../../services/engineOrchestrator');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');

/**
 * 1. استعلام قائمة كافة المحركات المسجلة وحالتها ومقاييس أدائها
 * GET /api/engines أو GET /api/v4/engines
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;

    const list = engineRegistry.list(filter);
    res.json({
      success: true,
      count: list.length,
      engines: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. فحص شامل لصحة كافة المحركات المركزية والفرعية
 * GET /api/engines/health أو GET /api/v4/engines/health
 */
router.get('/health', requireAuth, async (req, res) => {
  try {
    const healthReport = await engineRegistry.checkAllHealth();
    res.json({
      success: true,
      ...healthReport
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. فحص صحة محرك معين بالمعرف
 * GET /api/engines/:id/health
 */
router.get('/:id/health', requireAuth, async (req, res) => {
  try {
    const report = await engineRegistry.checkEngineHealth(req.params.id);
    if (report.status === 'NOT_FOUND') {
      return res.status(404).json({ error: `Engine "${req.params.id}" not found` });
    }
    res.json({ success: true, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. استعلام سجلات تدفق واستدعاء المحركات الموحدة (Orchestration Invocation Logs)
 * GET /api/engines/logs
 */
router.get('/logs', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const filter = {};
    if (req.query.engineId) filter.engineId = req.query.engineId;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';
    if (req.query.userId) filter.userId = req.query.userId;

    const logs = engineOrchestrator.getRecentLogs(limit, filter);
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. استدعاء آمن لعملية محرك عبر المنسق المركزي
 * POST /api/engines/invoke
 */
router.post('/invoke', requireAuth, async (req, res) => {
  const { engineId, operation, params } = req.body;
  if (!engineId || !operation) {
    return res.status(400).json({ error: 'engineId and operation are required' });
  }

  try {
    const context = {
      userId: req.user?.id || req.user?.username || 'ANONYMOUS',
      userRole: req.user?.role || 'user',
      correlationId: req.headers['x-correlation-id'] || null
    };

    const result = await engineOrchestrator.invoke(engineId, operation, params || [], context);
    res.json({
      success: true,
      engineId,
      operation,
      result
    });
  } catch (err) {
    res.status(err.code === 'CIRCULAR_DEPENDENCY_DETECTED' ? 409 : (err.code === 'ENGINE_NOT_FOUND' || err.code === 'OPERATION_NOT_FOUND' ? 404 : 500)).json({
      error: err.message,
      errorCode: err.code || 'INVOCATION_FAILED'
    });
  }
});

module.exports = router;

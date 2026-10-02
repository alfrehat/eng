/**
 * Administration/API/enginesController.js
 * 🏛️ موجه إدارة وتشخيص المحركات المركزية (Enterprise Engine Management & Diagnostics Router)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Engine Controller Patch
 */

'use strict';

const express = require('express');
const router = express.Router();
const engineRegistry = require('../../services/engineRegistry');
const engineOrchestrator = require('../../services/engineOrchestrator');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');
const { logInfo, logWarn, logError } = require('../../services/loggerService');

/**
 * 1. استعلام قائمة كافة المحركات المسجلة وحالتها
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;

    const list = typeof engineRegistry.list === 'function' ? engineRegistry.list(filter) : [];
    res.json({
      success: true,
      count: list.length,
      engines: list
    });
  } catch (err) {
    logError('EnginesController', `Failed to list engines: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. فحص شامل لصحة كافة المحركات المركزية والفرعية
 */
router.get('/health', requireAuth, async (req, res) => {
  try {
    let healthReport;
    if (typeof engineOrchestrator.getSystemHealthReport === 'function') {
      healthReport = await engineOrchestrator.getSystemHealthReport();
    } else if (typeof engineRegistry.checkAllHealth === 'function') {
      healthReport = await engineRegistry.checkAllHealth();
    } else {
      healthReport = { overallHealthy: true, message: 'System engines operational' };
    }

    res.json({
      success: true,
      ...healthReport
    });
  } catch (err) {
    logError('EnginesController', `Health aggregation failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. فحص صحة محرك معين بالمعرف
 */
router.get('/:id/health', requireAuth, async (req, res) => {
  try {
    const engineId = req.params.id;
    let report = null;

    if (typeof engineRegistry.get === 'function') {
      const entry = engineRegistry.get(engineId);
      if (!entry) {
        return res.status(404).json({ success: false, error: `المحرك المطلوب [${engineId}] غير مسجل بالنظام.` });
      }
      const inst = entry.instance || entry;
      if (inst && typeof inst.healthCheck === 'function') {
        report = await inst.healthCheck();
      } else {
        report = { healthy: true, status: inst?.status || 'READY_NO_PROBE', engineId };
      }
    } else if (typeof engineRegistry.checkEngineHealth === 'function') {
      report = await engineRegistry.checkEngineHealth(engineId);
    }

    res.json({ success: true, ...report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. استعلام سجلات تدفق واستدعاء المحركات الموحدة (Orchestration Invocation Logs)
 */
router.get('/logs', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const filter = {};
    if (req.query.engineId) filter.engineId = req.query.engineId;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';
    if (req.query.userId) filter.userId = req.query.userId;

    const logs = typeof engineOrchestrator.getRecentLogs === 'function' 
      ? engineOrchestrator.getRecentLogs(limit, filter) 
      : [];
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    logError('EnginesController', `Failed to retrieve logs: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. استدعاء آمن لعملية محرك
 */
router.post('/invoke', requireAuth, requireAdmin, async (req, res) => {
  const { engineId, operation, params = [] } = req.body;
  if (!engineId || !operation) {
    return res.status(400).json({ success: false, error: 'engineId و operation حقول إلزامية للاستدعاء.' });
  }
  if (typeof operation !== 'string' || operation.startsWith('_') || operation.includes('prototype') || operation === 'constructor') {
    return res.status(403).json({ success: false, error: 'حظر أمني: لا يمكن استدعاء دوال التهيئة أو الدوال الداخلية الخاصة.' });
  }

  try {
    let result;
    if (typeof engineOrchestrator.invoke === 'function') {
      const context = {
        userId: req.user?.id || req.user?.username || 'ADMIN_USER',
        userRole: req.user?.role || 'admin',
        correlationId: req.headers['x-correlation-id'] || null
      };
      result = await engineOrchestrator.invoke(engineId, operation, params, context);
    } else {
      const entry = typeof engineRegistry.get === 'function' ? engineRegistry.get(engineId) : null;
      const instance = entry?.instance || entry;

      if (!instance) {
        return res.status(404).json({ success: false, error: `المحرك [${engineId}] غير موجود.` });
      }

      if (typeof instance[operation] !== 'function') {
        return res.status(404).json({ success: false, error: `العملية [${operation}] غير معرّفة في المحرك [${engineId}].` });
      }

      result = await instance[operation](...(Array.isArray(params) ? params : [params]));
    }
    
    logInfo('EnginesController', `⚡ تم استدعاء [${engineId}.${operation}] بنجاح بواسطة [${req.user?.username}]`);
    res.json({
      success: true,
      engineId,
      operation,
      result
    });
  } catch (err) {
    logError('EnginesController', `فشل استدعاء العملية [${engineId}.${operation}]: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

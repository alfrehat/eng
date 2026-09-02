/**
 * services/engineOrchestrator.js
 * 🎼 منسق المحركات المركزي الموحد (Enterprise Engine Orchestrator)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v1.0
 * 
 * المبادئ الهندسية:
 * 1. استدعاء موحد وآمن لكافة العمليات عبر المحركات المسجلة في السجل المركزي.
 * 2. الكشف الفوري ومنع الاعتماديات الدائرية (Circular Dependencies Detection & Prevention).
 * 3. تسجيل تدقيق وأداء موحد (Unified Invocation Logging & Audit Trail) مع correlationId.
 * 4. عزل تام للأخطاء وضمان الاستقرار التشغيلي لبيئة الإنتاج.
 */

const crypto = require('crypto');
const engineRegistry = require('./engineRegistry');
const { logInfo, logWarn, logError } = require('../utils/logger');

class EngineOrchestrator {
  constructor() {
    this.registry = engineRegistry;
    this._recentLogs = [];
    this.maxLogs = 500;
  }

  /**
   * توليد معرف تتبع فريد للعملية
   */
  generateCorrelationId() {
    return 'CORR-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
  }

  /**
   * فحص ومنع الاستدعاء الدائري
   * @param {Array<string>} callStack - مصفوفة المحركات النشطة في سلسلة الاستدعاء الحالية
   * @param {string} targetEngineId - المحرك المستهدف
   */
  assertNoCircularDependency(callStack, targetEngineId) {
    if (!Array.isArray(callStack)) return;
    const normalizedTarget = targetEngineId.toUpperCase();
    if (callStack.includes(normalizedTarget)) {
      const cyclePath = [...callStack, normalizedTarget].join(' ➔ ');
      const err = new Error(`⛔ Circular Dependency Detected across engines: [${cyclePath}]`);
      err.code = 'CIRCULAR_DEPENDENCY_DETECTED';
      err.cycle = cyclePath;
      throw err;
    }
  }

  /**
   * الاستدعاء المركزي الموحد لأي عملية في أي محرك
   * @param {string} engineId - معرف المحرك (مثل: NUMBERING_ENGINE, BUSINESS_RULES_ENGINE)
   * @param {string} operation - اسم العملية المطلوب تنفيذها
   * @param {Array|Object} params - المعاملات الممررة
   * @param {Object} context - سياق العملية { userId, userRole, correlationId, callStack, metadata }
   * @returns {Promise<any>}
   */
  async invoke(engineId, operation, params = [], context = {}) {
    const startTime = Date.now();
    const normalizedEngineId = (engineId || '').toUpperCase();
    const correlationId = context.correlationId || this.generateCorrelationId();
    const userId = context.userId || 'SYSTEM';
    const currentStack = Array.isArray(context.callStack) ? [...context.callStack] : [];

    // 1. فحص الاعتماد الدائري
    this.assertNoCircularDependency(currentStack, normalizedEngineId);

    // تحديث مكدس الاستدعاء للطبقات التالية
    const nextStack = [...currentStack, normalizedEngineId];
    const nextContext = {
      ...context,
      correlationId,
      callStack: nextStack
    };

    // 2. التحقق من وجود المحرك في السجل
    const engineEntry = this.registry.get(normalizedEngineId);
    if (!engineEntry) {
      const err = new Error(`Engine "${normalizedEngineId}" is not registered in EngineRegistry`);
      err.code = 'ENGINE_NOT_FOUND';
      this._recordLog({
        engineId: normalizedEngineId,
        operation,
        userId,
        correlationId,
        durationMs: Date.now() - startTime,
        success: false,
        errorCode: err.code,
        errorMessage: err.message
      });
      throw err;
    }

    // 3. التحقق من وجود العملية
    const opFunction = engineEntry.exposedOperations && engineEntry.exposedOperations[operation];
    if (!opFunction || typeof opFunction !== 'function') {
      const err = new Error(`Operation "${operation}" is not exposed by engine "${normalizedEngineId}"`);
      err.code = 'OPERATION_NOT_FOUND';
      this._recordLog({
        engineId: normalizedEngineId,
        operation,
        userId,
        correlationId,
        durationMs: Date.now() - startTime,
        success: false,
        errorCode: err.code,
        errorMessage: err.message
      });
      throw err;
    }

    // 3.5 فحص الأذونات والصلاحيات للمستدعي إذا تم تحديد سياق المستخدم أو الإذن المطلوب
    const rbacManager = require('../middlewares/rbacManager');
    if (context.requiredPermission && context.user) {
      if (!rbacManager.hasPermission(context.user, context.requiredPermission)) {
        const err = new Error(`Unauthorized invocation: Missing required permission [${context.requiredPermission}]`);
        err.code = 'FORBIDDEN';
        this._recordLog({
          engineId: normalizedEngineId,
          operation,
          userId,
          correlationId,
          durationMs: Date.now() - startTime,
          success: false,
          errorCode: err.code,
          errorMessage: err.message
        });
        throw err;
      }
    }

    // 4. تنفيذ العملية
    let result = null;
    try {
      if (Array.isArray(params)) {
        result = await opFunction(...params, nextContext);
      } else {
        result = await opFunction(params, nextContext);
      }

      const durationMs = Date.now() - startTime;
      this.registry.recordInvocation(normalizedEngineId, durationMs, true);

      this._recordLog({
        engineId: normalizedEngineId,
        operation,
        userId,
        correlationId,
        durationMs,
        success: true,
        errorCode: null,
        errorMessage: null
      });

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.registry.recordInvocation(normalizedEngineId, durationMs, false, err);

      this._recordLog({
        engineId: normalizedEngineId,
        operation,
        userId,
        correlationId,
        durationMs,
        success: false,
        errorCode: err.code || 'EXECUTION_ERROR',
        errorMessage: err.message
      });

      logError('EngineOrchestrator', `Invocation failed [${normalizedEngineId}.${operation}]: ${err.message}`, {
        correlationId,
        userId,
        durationMs,
        errorCode: err.code
      });

      throw err;
    }
  }

  /**
   * تسجيل سجل استدعاء موحد
   */
  _recordLog(logEntry) {
    const entry = {
      ...logEntry,
      timestamp: new Date().toISOString()
    };

    this._recentLogs.unshift(entry);
    if (this._recentLogs.length > this.maxLogs) {
      this._recentLogs.pop();
    }
  }

  /**
   * جلب سجلات الاستدعاء الحديثة
   */
  getRecentLogs(limit = 100, filter = {}) {
    let list = this._recentLogs;
    if (filter.engineId) {
      const target = filter.engineId.toUpperCase();
      list = list.filter(l => l.engineId === target);
    }
    if (filter.success !== undefined) {
      list = list.filter(l => l.success === filter.success);
    }
    if (filter.userId) {
      list = list.filter(l => l.userId === filter.userId);
    }
    return list.slice(0, limit);
  }

  /**
   * تنفيذ سلسلة عمليات متسلسلة (Pipeline Execution)
   * @param {Array<Object>} steps - [{ engineId, operation, paramMapper }]
   * @param {any} initialInput - المدخل الأولي
   * @param {Object} context - سياق العملية
   */
  async executePipeline(steps = [], initialInput = null, context = {}) {
    let currentData = initialInput;
    const correlationId = context.correlationId || this.generateCorrelationId();
    const pipelineContext = { ...context, correlationId };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const params = typeof step.paramMapper === 'function' 
        ? step.paramMapper(currentData, pipelineContext) 
        : (step.params || [currentData]);

      currentData = await this.invoke(step.engineId, step.operation, params, pipelineContext);
    }

    return currentData;
  }
}

module.exports = new EngineOrchestrator();

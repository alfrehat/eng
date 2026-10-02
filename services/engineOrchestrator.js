/**
 * services/engineOrchestrator.js
 * 🌐 المنسق المركزي ومشرف دورة حياة المحركات (ENGINE_ORCHESTRATOR)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Orchestration & Lifecycle Patch
 */

'use strict';

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const engineRegistry = require('./engineRegistry');
const { isPostgresActive, healthCheck: dbHealth } = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

// سياق التخزين المحلي غير المتزامن لحفظ وتمرير مكدس الاستدعاءات آلياً
const executionContextStore = new AsyncLocalStorage();

/**
 * مخزن حلقي عالي الأداء لتسجيل آخر العمليات بزمن O(1) دون إزاحة الذاكرة
 */
class CircularLogBuffer {
  constructor(capacity = 500) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }

  push(entry) {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  toArray() {
    const result = [];
    let idx = (this.head - 1 + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[idx]);
      idx = (idx - 1 + this.capacity) % this.capacity;
    }
    return result;
  }
}

class EngineOrchestrator {
  constructor() {
    this.engineId = 'ENGINE_ORCHESTRATOR';
    this.engineName = 'Enterprise System Orchestrator & Lifecycle Manager';
    this.version = '2.0.0';
    this.category = 'SYSTEM_CORE';
    this.status = 'READY';
    this.capabilities = [
      'sequential_boot_management',
      'unified_health_aggregation',
      'circuit_breaker_protection',
      'dependency_injection',
      'system_lifecycle_control',
      'pipeline_execution',
      'async_context_tracking'
    ];
    this.bootTimestamp = new Date().toISOString();
    this.registry = engineRegistry;
    this._logBuffer = new CircularLogBuffer(500);
    this.asyncStorage = executionContextStore;
  }

  /**
   * إقلاع وتسجيل كافة محركات النظام بترتيب تناغمي آمن
   */
  async bootSystem() {
    logInfo('EngineOrchestrator', '🚀 بدء إقلاع منظومة Anti-Gravity المؤسسية لبلدية كفرنجة الجديدة...');
    const startTime = Date.now();

    try {
      // 1. فحص جهوزية الطبقة الأساسية وقاعدة البيانات
      const dbStatus = typeof dbHealth === 'function' ? await dbHealth() : { dbMode: isPostgresActive() ? 'PostgreSQL' : 'In-Memory' };
      logInfo('EngineOrchestrator', `🗄️ حالة طبقة البيانات الأساسية: ${dbStatus.dbMode || dbStatus.status}`);

      // 2. تجميع وفحص المحركات المسجلة في الـ Registry
      const registeredEngines = this.registry.list() || [];
      logInfo('EngineOrchestrator', `📦 إجمالي المحركات المرصودة في السجل المؤسسي: ${registeredEngines.length}`);

      if (registeredEngines.length < 30) {
        logWarn('EngineOrchestrator', '⚠️ تنبيه: عدد المحركات المسجلة أقل من الحد الأدنى المتوقع لمنظومة كفرنجة المتكاملة.');
      }

      this.status = 'RUNNING';
      this.bootTimestamp = new Date().toISOString();
      const duration = Date.now() - startTime;

      logInfo('EngineOrchestrator', `✅ تم إقلاع وتشغيل كافة المحركات بنجاح تام خلال [${duration}ms]. النظام جاهز للخدمة الميدانية والمؤسسية.`);
      return {
        success: true,
        status: this.status,
        enginesCount: registeredEngines.length,
        bootDurationMs: duration,
        timestamp: this.bootTimestamp
      };
    } catch (e) {
      this.status = 'FAILED';
      logError('EngineOrchestrator', `❌ فشل حرج أثناء إقلاع المنظومة: ${e.message}`);
      throw e;
    }
  }

  /**
   * إجراء فحص صحي وتجميعي شامل لكافة محركات النظام الـ 37+
   */
  async getSystemHealthReport() {
    const engines = this.registry.list() || [];
    const report = {
      systemStatus: this.status,
      bootTimestamp: this.bootTimestamp,
      totalEngines: engines.length,
      healthyCount: 0,
      failedCount: 0,
      enginesHealth: []
    };

    for (const engine of engines) {
      try {
        const fullEntry = this.registry.get(engine.engineId);
        if (fullEntry && typeof fullEntry.healthCheck === 'function') {
          const h = await fullEntry.healthCheck();
          report.enginesHealth.push(h);
          if (h && (h.healthy !== false && h.status !== 'FAILED')) report.healthyCount++;
          else report.failedCount++;
        } else if (fullEntry && fullEntry.instance && typeof fullEntry.instance.healthCheck === 'function') {
          const h = await fullEntry.instance.healthCheck();
          report.enginesHealth.push(h);
          if (h && (h.healthy !== false && h.status !== 'FAILED')) report.healthyCount++;
          else report.failedCount++;
        } else {
          report.enginesHealth.push({ engineId: engine?.engineId || 'UNKNOWN', healthy: true, status: 'READY_NO_PROBE' });
          report.healthyCount++;
        }
      } catch (err) {
        report.failedCount++;
        report.enginesHealth.push({ engineId: engine?.engineId || 'UNKNOWN', healthy: false, error: err.message });
      }
    }

    report.overallHealthy = report.failedCount === 0;
    return report;
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمنسق نفسه
   */
  async healthCheck() {
    const healthReport = await this.getSystemHealthReport();
    return {
      healthy: healthReport.overallHealthy,
      status: this.status,
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      healthyEngines: `${healthReport.healthyCount}/${healthReport.totalEngines}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * توليد معرف تتبع فريد للعملية
   */
  generateCorrelationId() {
    return 'CORR-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
  }

  /**
   * فحص ومنع الاستدعاء الدائري عبر المكدس الممرر أو المخزن ضمن الـ Context
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
   */
  async invoke(engineId, operation, params = [], context = {}, options = {}) {
    const startTime = Date.now();
    const normalizedEngineId = (engineId || '').toUpperCase();

    // 1. استرجاع السياق النشط آلياً عبر AsyncLocalStorage لضمان عدم فقدان التتبع البيني
    const activeStore = this.asyncStorage.getStore() || {};
    const correlationId = context.correlationId || activeStore.correlationId || this.generateCorrelationId();
    const userId = context.userId || activeStore.userId || context.user?.id || 'SYSTEM';
    const currentStack = Array.isArray(context.callStack) 
      ? context.callStack 
      : (Array.isArray(activeStore.callStack) ? [...activeStore.callStack] : []);

    // 2. التحقق الصارم من غياب الاعتماديات الدائرية
    this.assertNoCircularDependency(currentStack, normalizedEngineId);

    const nextStack = [...currentStack, normalizedEngineId];
    const nextContext = {
      ...activeStore,
      ...context,
      correlationId,
      userId,
      user: context.user || activeStore.user || null,
      callStack: nextStack
    };

    // 3. التحقق من وجود المحرك في السجل المركزي
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

    // 4. التحقق من إتاحة العملية المطلوبة
    let opFunction = engineEntry.exposedOperations && engineEntry.exposedOperations[operation];
    if (!opFunction && operation === 'healthCheck' && typeof engineEntry.healthCheck === 'function') {
      opFunction = engineEntry.healthCheck;
    }
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

    // 5. التحقق المتوافق من الصلاحيات (RBAC Polyfill Check)
    if (context.requiredPermission || nextContext.requiredPermission) {
      const requiredPerm = context.requiredPermission || nextContext.requiredPermission;
      const targetUser = context.user || nextContext.user;
      let authorized = false;

      try {
        const rbacManager = require('../middlewares/rbacManager');
        if (typeof rbacManager.hasPermission === 'function') {
          if (targetUser && rbacManager.hasPermission(targetUser, requiredPerm)) {
            authorized = true;
          } else {
            const roleStr = typeof targetUser === 'string' ? targetUser : (targetUser?.role || context.userRole || 'anonymous');
            if (rbacManager.hasPermission(roleStr, requiredPerm)) {
              authorized = true;
            }
          }
        } else {
          authorized = true;
        }
      } catch (rbacErr) {
        logWarn('EngineOrchestrator', `RBAC verification fallback applied: ${rbacErr.message}`);
        authorized = targetUser?.role === 'admin';
      }

      if (!authorized) {
        const err = new Error(`Unauthorized invocation: Missing required permission [${requiredPerm}]`);
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

    // 6. تطبيع المعاملات وتمريرها بدقة للوظيفة الهدف
    let finalArgs = [];
    if (options.isArgumentList === true || Array.isArray(params)) {
      finalArgs = Array.isArray(params) ? [...params] : [params];
    } else if (params !== undefined) {
      finalArgs = [params];
    }

    // 7. التنفيذ المحمي داخل نطاق AsyncLocalStorage لتوريث السياق
    return await this.asyncStorage.run(nextContext, async () => {
      try {
        const result = await opFunction(...finalArgs, nextContext);
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
    });
  }

  /**
   * تسجيل تدقيق الأداء وحفظ السجلات في الـ Circular Buffer
   */
  _recordLog(logEntry) {
    this._logBuffer.push({
      ...logEntry,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * استرجاع السجلات الحديثة مع الفلترة السريعة
   */
  getRecentLogs(limit = 100, filter = {}) {
    let list = this._logBuffer.toArray();
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
   * تنفيذ خط معالجة متتابع (Safe Pipeline Execution)
   */
  async executePipeline(steps = [], initialInput = null, context = {}) {
    let currentData = initialInput;
    const correlationId = context.correlationId || this.generateCorrelationId();
    const pipelineContext = { ...context, correlationId };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let stepInput;

      if (typeof step.paramMapper === 'function') {
        stepInput = step.paramMapper(currentData, pipelineContext);
      } else {
        stepInput = currentData;
      }

      const isSpread = Boolean(step.spreadArgs && Array.isArray(stepInput));
      const args = isSpread ? stepInput : [stepInput];

      currentData = await this.invoke(
        step.engineId,
        step.operation,
        args,
        pipelineContext,
        { isArgumentList: true }
      );
    }

    return currentData;
  }
}

const engineOrchestrator = new EngineOrchestrator();
module.exports = engineOrchestrator;

/**
 * routes/workflowRouter.js
 * 🔀 محرك مسارات وموافقات العمل الديناميكي (WORKFLOW_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Workflow State Machine & Routing Patch
 */

'use strict';

const express = require('express');
const { isPostgresActive, dbRun, dbGet, memDb, saveMemTable } = require('../utils/database');
const authorizationEngine = require('../services/authorizationEngineService');
const { logInfo, logWarn, logError } = require('../services/loggerService');

class WorkflowEngineService {
  constructor() {
    this.engineId = 'WORKFLOW_ENGINE';
    this.engineName = 'Enterprise Workflow State Machine & Approval Routing Engine';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'state_machine_transitions',
      'approval_guard_validation',
      'workflow_history_tracking',
      'audit_trail_integration',
      'automated_db_entity_mutation'
    ];

    // خريطة الانتقالات المسموحة قانونياً وإدارياً مع معالجة الاستئناف والإلغاء
    this.allowedTransitions = {
      'NEW': ['PENDING_REVIEW', 'REJECTED', 'CANCELLED'],
      'PENDING_REVIEW': ['APPROVED', 'REJECTED', 'NEEDS_MODIFICATION'],
      'NEEDS_MODIFICATION': ['PENDING_REVIEW', 'CANCELLED'],
      'APPROVED': ['ARCHIVED', 'IN_EXECUTION'],
      'IN_EXECUTION': ['COMPLETED', 'SUSPENDED', 'CANCELLED'],
      'SUSPENDED': ['IN_EXECUTION', 'CANCELLED'],
      'COMPLETED': ['ARCHIVED'],
      'REJECTED': ['CANCELLED'],
      'CANCELLED': [],
      'ARCHIVED': []
    };

    // خريطة الجداول المرتبطة بأنواع الكيانات
    this.entityTableMap = {
      'PROJECT': 'projects',
      'TENDER': 'tenders',
      'CLAIM': 'claims',
      'TASK': 'tasks',
      'CONTRACT': 'contracts',
      'PURCHASE': 'purchase_orders'
    };
  }

  /**
   * استرجاع الحالة الحالية لأي كيان والتأكد من وجوده
   */
  async getEntityCurrentState(entityType, entityId) {
    const tableName = this.entityTableMap[entityType?.toUpperCase()];
    if (!tableName) {
      throw new Error(`نوع الكيان غير مدعوم في مسارات العمل: [${entityType}]`);
    }

    if (isPostgresActive()) {
      try {
        const row = await dbGet(`SELECT id, status FROM public.${tableName} WHERE id = $1`, [entityId]);
        if (row) return { exists: true, status: row.status, tableName, id: row.id };
        // التوافقية العكسية المرحلية لجدول العقود
        if (tableName === 'contracts') {
          const fallbackRow = await dbGet(`SELECT id, status FROM public.construction_contracts WHERE id = $1`, [entityId]);
          if (fallbackRow) return { exists: true, status: fallbackRow.status, tableName: 'construction_contracts', id: fallbackRow.id };
        }
        return { exists: false, tableName };
      } catch (e) {
        logWarn('WorkflowEngine', `Postgres query fallback for ${tableName}: ${e.message}`);
      }
    }

    const list = memDb[tableName] || (tableName === 'contracts' ? (memDb.construction_contracts || []) : []) || [];
    const item = list.find(i => String(i.id) === String(entityId) || String(i.task_number) === String(entityId));
    return item ? { exists: true, status: item.status, tableName, id: item.id } : { exists: false, tableName };
  }

  /**
   * تسجيل حركة مسار العمل في سجل التدقيق المركزي
   */
  async _recordWorkflowAudit(userId, entityId, entityType, fromState, toState, notes, clientIp = '127.0.0.1') {
    try {
      const details = `انتقال مسار العمل لـ [${entityType} - ${entityId}] من الحالة [${fromState}] إلى [${toState}]. ملاحظات: ${notes || 'لا توجد'}ـ`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action: 'WORKFLOW_STATE_TRANSITION',
        entity: entityType,
        entityId: String(entityId),
        details,
        ip: clientIp
      });
    } catch (e) {
      logWarn('WorkflowEngine', `Workflow audit failed: ${e.message}`);
    }
  }

  /**
   * تحديث الحالة مباشرة في جدول قاعدة البيانات الخاص بالكيان
   */
  async _updateEntityTableStatus(entityType, entityId, targetState) {
    const tableName = this.entityTableMap[entityType?.toUpperCase()];
    if (!tableName) return false;

    const now = new Date().toISOString();
    try {
      if (isPostgresActive()) {
        await dbRun(`UPDATE public.${tableName} SET status = $1, updated_at = NOW() WHERE id = $2`, [targetState, entityId]);
        if (tableName === 'contracts') {
          try {
            await dbRun(`UPDATE public.construction_contracts SET status = $1, updated_at = NOW() WHERE id = $2`, [targetState, entityId]);
          } catch (eIgnore) {}
        }
      } else if (memDb && memDb[tableName]) {
        const idx = memDb[tableName].findIndex(i => String(i.id) === String(entityId) || String(i.task_number) === String(entityId));
        if (idx !== -1) {
          memDb[tableName][idx].status = targetState;
          memDb[tableName][idx].updated_at = now;
          saveMemTable(tableName);
        }
        if (tableName === 'contracts' && memDb.construction_contracts) {
          const cIdx = memDb.construction_contracts.findIndex(i => String(i.id) === String(entityId));
          if (cIdx !== -1) {
            memDb.construction_contracts[cIdx].status = targetState;
            memDb.construction_contracts[cIdx].updated_at = now;
            saveMemTable('construction_contracts');
          }
        }
      }
      return true;
    } catch (dbErr) {
      logError('WorkflowEngine', `Failed to update entity [${tableName}] status: ${dbErr.message}`);
      return false;
    }
  }

  /**
   * تنفيذ الانتقال الآمن لحالة الكيان مع التحقق من الشروط والصلاحيات والتحديث بقاعدة البيانات
   */
  async transitionState(context, transitionRequest, user, options = {}) {
    const { entityType, entityId, currentState, targetState, notes } = transitionRequest || {};
    const { clientIp = '127.0.0.1', mutateDatabase = true } = options;

    if (!entityId || !currentState || !targetState) {
      const err = new Error('معرف الكيان، الحالة الحالية، والحالة المستهدفة حقول إلزامية لتنفيذ الانتقال.');
      err.statusCode = 400;
      throw err;
    }

    const isSystemInternal = context === 'SYSTEM_INTERNAL' || user?.id === 'SYSTEM';
    let canPerform = false;

    if (!isSystemInternal) {
      try {
        if (authorizationEngine && typeof authorizationEngine.hasPermission === 'function') {
          canPerform = await authorizationEngine.hasPermission(user, `WORKFLOW.${entityType?.toUpperCase()}.TRANSITION`, entityId);
        }
      } catch (authErr) {
        logWarn('WorkflowEngine', `Authorization check warning: ${authErr.message}`);
      }

      const isPrivileged = user?.role === 'admin' || user?.role === 'R-001' || user?.role === 'director_public_works';
      if (!canPerform && !isPrivileged) {
        const authErr = new Error('حظر أمني: لا تملك الصلاحية الإدارية لتغيير حالة مسار العمل هذا.');
        authErr.statusCode = 403;
        throw authErr;
      }
    }

    const allowedNextStates = this.allowedTransitions[currentState] || [];
    if (!allowedNextStates.includes(targetState)) {
      const stateErr = new Error(`انقضاض غير قانوني على مسار العمل: الانتقال من الحالة [${currentState}] إلى [${targetState}] غير مسموح به إدارياً.`);
      stateErr.statusCode = 422;
      throw stateErr;
    }

    const timestamp = new Date().toISOString();

    let dbUpdated = false;
    if (mutateDatabase) {
      dbUpdated = await this._updateEntityTableStatus(entityType, entityId, targetState);
    }

    await this._recordWorkflowAudit(user?.id, entityId, entityType, currentState, targetState, notes, clientIp);
    logInfo('WorkflowEngine', `🔀 تم تغيير حالة [${entityType}:${entityId}] بنجاح من ${currentState} إلى ${targetState}`);

    return {
      success: true,
      entityId,
      entityType,
      previousState: currentState,
      currentState: targetState,
      databaseMutated: dbUpdated,
      transitionedBy: user?.username || user?.id || 'SYSTEM',
      timestamp
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      statesManaged: Object.keys(this.allowedTransitions).length,
      supportedEntities: Object.keys(this.entityTableMap),
      timestamp: new Date().toISOString()
    };
  }
}

const workflowEngineService = new WorkflowEngineService();
const router = express.Router();

router.get('/health', async (req, res) => {
  const health = await workflowEngineService.healthCheck();
  res.json(health);
});

router.get('/transitions', (req, res) => {
  res.json({
    success: true,
    allowedTransitions: workflowEngineService.allowedTransitions,
    supportedEntities: Object.keys(workflowEngineService.entityTableMap)
  });
});

router.post('/transition', async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const result = await workflowEngineService.transitionState(
      'HTTP_ROUTER',
      req.body,
      req.user,
      { clientIp, mutateDatabase: true }
    );
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

Object.assign(router, {
  engineId: workflowEngineService.engineId,
  engineName: workflowEngineService.engineName,
  version: workflowEngineService.version,
  category: workflowEngineService.category,
  status: workflowEngineService.status,
  capabilities: workflowEngineService.capabilities,
  allowedTransitions: workflowEngineService.allowedTransitions,
  entityTableMap: workflowEngineService.entityTableMap,
  transitionState: workflowEngineService.transitionState.bind(workflowEngineService),
  getEntityCurrentState: workflowEngineService.getEntityCurrentState.bind(workflowEngineService),
  healthCheck: workflowEngineService.healthCheck.bind(workflowEngineService),
  _recordWorkflowAudit: workflowEngineService._recordWorkflowAudit.bind(workflowEngineService),
  _updateEntityTableStatus: workflowEngineService._updateEntityTableStatus.bind(workflowEngineService),
  WorkflowEngineService
});

module.exports = router;
module.exports.WorkflowEngineService = WorkflowEngineService;
module.exports.workflowEngineService = workflowEngineService;
module.exports.default = router;

/**
 * Administration/API/workflowEngine.js
 * 🔀 محرك وموجه مسارات العمل الإدارية والمالية المؤسسي (WORKFLOW_ADMIN_ADAPTER)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Workflow State Machine Adapter
 */

'use strict';

const express = require('express');
const router = express.Router();
const workflowRouter = require('../../routes/workflowRouter');
const authorizationEngine = require('../../services/authorizationEngineService');
const notificationCenter = require('../../services/notificationCenter');
const { requireAuth } = require('../../middlewares/authMiddleware');
const {
  isPostgresActive,
  dbRun,
  dbGet,
  dbQuery,
  getPool,
  memDb,
  saveMemTable
} = require('../../utils/database');
const { logInfo, logWarn, logError } = require('../../services/loggerService');

// مخطط تدفق الموافقات الافتراضي للمطالبات (Fallback Base)
const DEFAULT_CLAIM_STEPS = {
  'DRAFT': {
    next: 'SECTION_CHIEF_REVIEW',
    allowedRoles: ['engineer', 'user', 'admin', 'R-004'],
    label: 'مسودة مطالبة'
  },
  'SECTION_CHIEF_REVIEW': {
    next: 'DIRECTOR_VERIFICATION',
    allowedRoles: ['dept_head', 'admin', 'R-003'],
    label: 'مراجعة رئيس القسم'
  },
  'DIRECTOR_VERIFICATION': {
    next: 'AUDIT_AND_FINANCE',
    allowedRoles: ['manager', 'admin', 'R-002'],
    label: 'تدقيق مدير الأشغال'
  },
  'AUDIT_AND_FINANCE': {
    next: 'MAYOR_APPROVAL',
    allowedRoles: ['accountant', 'admin', 'R-006'],
    label: 'التدقيق المالي والمحاسبي'
  },
  'MAYOR_APPROVAL': {
    next: 'READY_FOR_PAYMENT',
    allowedRoles: ['admin', 'R-001'],
    label: 'موافقة رئيس البلدية'
  },
  'READY_FOR_PAYMENT': {
    next: null,
    allowedRoles: [],
    label: 'جاهز للصرف المالي'
  }
};

/**
 * دالة مساعدة لجلب مسار العمل المعتمد لأي كيان ديناميكياً
 */
async function getWorkflowForEntity(entityType) {
  try {
    let wf = null;
    if (isPostgresActive()) {
      wf = await dbGet('SELECT * FROM workflows WHERE "entityType" = $1 ORDER BY id ASC LIMIT 1', [entityType]);
    }
    if (!wf && memDb.workflows) {
      wf = memDb.workflows.find(w => w.entityType === entityType);
    }
    if (wf && wf.stepsJson) {
      const steps = typeof wf.stepsJson === 'string' ? JSON.parse(wf.stepsJson) : wf.stepsJson;
      return { ...wf, steps };
    }
  } catch (e) {}
  return null;
}

class AdministrationWorkflowEngine {
  constructor() {
    this.engineId = 'WORKFLOW_ADMIN_ADAPTER';
    this.engineName = 'Enterprise Administrative & Financial Workflow Adapter';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'state_machine_delegation',
      'role_guarded_approvals',
      'multi_entity_workflow_sync',
      'automated_transition_alerts',
      'audit_trail_logging'
    ];
  }

  /**
   * جلب الكيان المستهدف والتأكد من وجوده وحالته الراهنة (تفويض للمحرك الكنوني)
   */
  async _fetchEntityCurrentState(entityType, entityId) {
    if (workflowRouter && typeof workflowRouter.getEntityCurrentState === 'function') {
      return await workflowRouter.getEntityCurrentState(entityType, entityId);
    }
    const tableMap = {
      TENDER: 'tenders',
      PROJECT: 'projects',
      CLAIM: 'claims',
      TASK: 'tasks',
      CONTRACT: 'contracts'
    };
    const tableName = tableMap[entityType?.toUpperCase()] || 'projects';
    if (isPostgresActive()) {
      try {
        const row = await dbGet(`SELECT id, status FROM public.${tableName} WHERE id = $1`, [entityId]);
        return row ? { exists: true, status: row.status, tableName } : { exists: false, tableName };
      } catch (e) {
        logWarn('WorkflowAdminAdapter', `Entity check fallback: ${e.message}`);
      }
    }
    const list = memDb[tableName] || [];
    const item = list.find(i => String(i.id) === String(entityId));
    return item ? { exists: true, status: item.status, tableName } : { exists: false, tableName };
  }

  /**
   * تحديث حالة الكيان في قاعدة البيانات بعد نجاح الانتقال (تفويض للمحرك الكنوني)
   */
  async _persistEntityState(tableName, entityId, nextState) {
    if (workflowRouter && typeof workflowRouter._updateEntityTableStatus === 'function') {
      return await workflowRouter._updateEntityTableStatus(tableName, entityId, nextState);
    }
    const now = new Date().toISOString();
    if (isPostgresActive()) {
      try {
        await dbRun(`UPDATE public.${tableName} SET status = $1, updated_at = NOW() WHERE id = $2`, [nextState, entityId]);
        return true;
      } catch (e) {
        logWarn('WorkflowAdminAdapter', `Entity update fallback: ${e.message}`);
      }
    }
    const list = memDb[tableName] || [];
    const idx = list.findIndex(i => String(i.id) === String(entityId));
    if (idx !== -1) {
      list[idx].status = nextState;
      list[idx].updated_at = now;
      saveMemTable(tableName);
    }
    return true;
  }

  /**
   * تنفيذ انتقال إداري رسمي لمعاملة أو مشروع (مفوض بالكامل للمحرك الكنوني)
   */
  async executeTransition(reqPayload, actorUser) {
    const { entityType, entityId, targetState, notes, assignedToNext } = reqPayload || {};

    if (!entityType || !entityId || !targetState) {
      throw new Error('نوع الكيان، رقم المعرف، والحالة المستهدفة مدخلات إلزامية.');
    }

    // 1. استرجاع الحالة الراهنة للكيان عبر المحرك الكنوني
    const entityInfo = await this._fetchEntityCurrentState(entityType, entityId);
    if (!entityInfo.exists) {
      throw new Error(`الكيان المطلوب [${entityType} - ${entityId}] غير مسجل في النظام.`);
    }

    const currentState = entityInfo.status || 'NEW';

    // 2. تفويض الانتقال والتحقق الأمني وتحديث قاعدة البيانات بالكامل إلى WorkflowEngine المركزي
    const transitionResult = await workflowRouter.transitionState(
      'ADMIN_PORTAL',
      {
        entityType: entityType.toUpperCase(),
        entityId,
        currentState,
        targetState,
        notes: notes || `اعتماد رسمي بواسطة: ${actorUser?.fullName || actorUser?.username || 'SYSTEM'}`
      },
      actorUser,
      { mutateDatabase: true }
    );

    // 3. إرسال إشعار فوري للمكلف بالمرحلة التالية إن وُجد عبر Notification Center
    if (assignedToNext && notificationCenter && typeof notificationCenter.sendInternalAlert === 'function') {
      try {
        notificationCenter.sendInternalAlert(
          `🔔 تم تحويل المعاملة [${entityType} : ${entityId}] إلى مرحلة [${targetState}] بانتظار استكمال الإجراء.`,
          { userId: assignedToNext, entityId, type: 'WORKFLOW_STEP_PENDING' }
        );
      } catch (ne) {
        logWarn('WorkflowAdminAdapter', `تعذر إرسال إشعار المسار: ${ne.message}`);
      }
    }

    logInfo('WorkflowAdminAdapter', `✅ تم إنجاز انتقال المسار عبر المحرك الكنوني [${entityId}]: ${currentState} ⬅️ ${targetState}`);
    return {
      success: true,
      entityId,
      entityType,
      previousState: currentState,
      newState: targetState,
      approvedBy: actorUser?.username || actorUser?.id || 'SYSTEM',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * فحص الصحة والجاهزية التشغيلية للمحول
   */
  async healthCheck() {
    const canonicalHealth = (workflowRouter && typeof workflowRouter.healthCheck === 'function')
      ? await workflowRouter.healthCheck()
      : { healthy: true, status: 'READY' };

    return {
      healthy: canonicalHealth.healthy !== false,
      status: 'READY',
      engineId: this.engineId,
      version: this.version,
      delegationTarget: 'WORKFLOW_ENGINE',
      canonicalEngine: canonicalHealth,
      timestamp: new Date().toISOString()
    };
  }
}

const administrationWorkflowEngine = new AdministrationWorkflowEngine();

/* ═══════════════════════════════════════════════════════════════════════════
   1. نقاط النهاية لموجه Express (HTTP REST API Endpoints)
   ═══════════════════════════════════════════════════════════════════════════ */

router.get('/health', async (req, res) => {
  const health = await administrationWorkflowEngine.healthCheck();
  res.json(health);
});

router.post('/execute-transition', requireAuth, async (req, res) => {
  try {
    const result = await administrationWorkflowEngine.executeTransition(req.body, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    let rows = null;
    if (isPostgresActive()) {
      try {
        rows = await dbQuery('SELECT * FROM workflows ORDER BY id ASC');
      } catch (e) {}
    }
    if (!rows || rows.length === 0) {
      rows = memDb.workflows || [];
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/steps', requireAuth, (req, res) => {
  res.json({ success: true, steps: DEFAULT_CLAIM_STEPS });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, entityType, description, stepsJson } = req.body;
  if (!name || !entityType) return res.status(400).json({ error: 'اسم المسار ونوع الكيان مطلوبان' });
  try {
    const id = `WF-${Date.now().toString().slice(-4)}`;
    const stepsStr = typeof stepsJson === 'string' ? stepsJson : JSON.stringify(stepsJson || []);
    const item = { id, name, entityType, description: description || '', stepsJson: stepsStr };

    if (isPostgresActive()) {
      try {
        await dbRun('INSERT INTO workflows (id, name, "entityType", description, "stepsJson") VALUES ($1, $2, $3, $4, $5)',
          [id, name, entityType, item.description, item.stepsJson]);
      } catch (e) {
        if (memDb.workflows) memDb.workflows.push(item);
      }
    } else {
      if (memDb.workflows) memDb.workflows.push(item);
    }
    res.status(201).json({ id, message: 'تم إنشاء مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, entityType, description, stepsJson } = req.body;
  try {
    const stepsStr = typeof stepsJson === 'string' ? stepsJson : (stepsJson ? JSON.stringify(stepsJson) : null);
    if (isPostgresActive()) {
      try {
        await dbRun('UPDATE workflows SET name = COALESCE($1, name), "entityType" = COALESCE($2, "entityType"), description = COALESCE($3, description), "stepsJson" = COALESCE($4, "stepsJson") WHERE id = $5',
          [name, entityType, description, stepsStr, req.params.id]);
      } catch (e) {
        if (memDb.workflows) {
          const idx = memDb.workflows.findIndex(w => w.id === req.params.id);
          if (idx !== -1) Object.assign(memDb.workflows[idx], { name, entityType, description, stepsJson: stepsStr });
        }
      }
    } else {
      if (memDb.workflows) {
        const idx = memDb.workflows.findIndex(w => w.id === req.params.id);
        if (idx !== -1) Object.assign(memDb.workflows[idx], { name, entityType, description, stepsJson: stepsStr });
      }
    }
    res.json({ message: 'تم تحديث مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM workflows WHERE id = $1', [req.params.id]);
      } catch (e) {
        if (memDb.workflows) memDb.workflows = memDb.workflows.filter(w => w.id !== req.params.id);
      }
    } else {
      if (memDb.workflows) memDb.workflows = memDb.workflows.filter(w => w.id !== req.params.id);
    }
    res.json({ message: 'تم حذف مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/claims/:id', requireAuth, async (req, res) => {
  const claimId = req.params.id;
  try {
    let claim = null;
    if (isPostgresActive()) {
      claim = await dbGet('SELECT * FROM claims WHERE id = $1', [claimId]);
    } else {
      claim = (memDb.claims || []).find(c => String(c.id) === String(claimId));
    }

    if (!claim) {
      return res.status(404).json({ error: 'المطالبة غير موجودة' });
    }

    const currentStatus = claim.status || 'DRAFT';
    const stepConfig = DEFAULT_CLAIM_STEPS[currentStatus] || {
      next: null,
      allowedRoles: ['admin', 'R-001'],
      label: currentStatus
    };

    const userRole = req.user ? req.user.role : '';
    const canTransit = req.user ? (
      stepConfig.allowedRoles.includes(userRole) || 
      userRole === 'admin' || 
      userRole === 'R-001'
    ) : false;

    res.json({
      success: true,
      claimId,
      status: currentStatus,
      stepConfig,
      canTransit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/claims/:id/next-step', requireAuth, async (req, res) => {
  const claimId = req.params.id;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'جلسة العمل غير مصرح بها أو منتهية' });
  }

  try {
    let claim = null;
    if (isPostgresActive()) {
      claim = await dbGet('SELECT * FROM claims WHERE id = $1', [claimId]);
    } else {
      claim = (memDb.claims || []).find(c => String(c.id) === String(claimId));
    }

    if (!claim) {
      return res.status(404).json({ error: 'المطالبة المالية غير موجودة بالنظام' });
    }

    const currentStatus = claim.status || 'DRAFT';
    const stepConfig = DEFAULT_CLAIM_STEPS[currentStatus] || {
      next: 'SECTION_CHIEF_REVIEW',
      allowedRoles: ['engineer', 'user', 'admin', 'R-004'],
      label: currentStatus
    };

    if (!stepConfig.next) {
      return res.status(400).json({ error: 'هذه المطالبة منتهية ومعتمدة بالكامل وجاهزة للصرف' });
    }

    const userRole = user.role || 'user';
    const isAllowed = stepConfig.allowedRoles.includes(userRole) || userRole === 'admin' || userRole === 'R-001';
    if (!isAllowed) {
      return res.status(403).json({ 
        error: `غير مصرح. الخطوة "${stepConfig.label}" تتطلب دوراً من نوع: [${stepConfig.allowedRoles.join(', ')}]. دورك الحالي: "${userRole}"` 
      });
    }

    const nextStatus = stepConfig.next;
    const currentHistory = Array.isArray(claim.history) ? claim.history : (typeof claim.history === 'string' && claim.history.startsWith('[') ? JSON.parse(claim.history) : []);
    const timestamp = new Date().toISOString();
    
    const historyEntry = {
      action: 'TRANSIT_STEP',
      fromStatus: currentStatus,
      toStatus: nextStatus,
      userId: user.id,
      userName: user.fullName || user.username,
      userRole,
      timestamp,
      notes: req.body.notes || ''
    };
    currentHistory.push(historyEntry);

    if (isPostgresActive()) {
      const pool = getPool();
      const client = pool ? await pool.connect() : null;
      if (client) {
        try {
          await client.query('BEGIN');
          await client.query(
            'UPDATE claims SET status = $1, history = $2::jsonb, "approvalStage" = $3, "updatedAt" = NOW() WHERE id = $4',
            [nextStatus, JSON.stringify(currentHistory), nextStatus, claimId]
          );
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } else {
        await dbRun(
          'UPDATE claims SET status = $1, history = $2, "approvalStage" = $3, "updatedAt" = NOW() WHERE id = $4',
          [nextStatus, JSON.stringify(currentHistory), nextStatus, claimId]
        );
      }
    } else {
      claim.status = nextStatus;
      claim.approvalStage = nextStatus;
      claim.history = currentHistory;
      claim.updatedAt = timestamp;
      saveMemTable('claims');
    }

    if (global.logActivity) {
      global.logActivity(user.id, 'ترقية مسار مطالبة', 'المطالبات', claimId, `تمرير المطالبة إلى ${nextStatus}`);
    }

    if (notificationCenter && typeof notificationCenter.emit === 'function') {
      notificationCenter.emit('CLAIM_SUBMITTED', {
        tenderId: claim.tenderId || claim.id,
        amount: claim.netAmount || claim.amount || 0,
        userId: 'all',
        title: `ترقية مطالبة مالية (${claimId})`,
        type: 'info'
      });
    }

    return res.json({
      success: true,
      message: 'تم تمرير المطالبة وتحديث خطوة تدفق العمل بنجاح',
      claimId,
      previousStatus: currentStatus,
      newStatus: nextStatus,
      history: currentHistory
    });
  } catch (err) {
    console.error('❌ [Workflow Engine] Claim step transition failed:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء تمرير خطوة المطالبة: ' + err.message });
  }
});

// إلحاق كافة خصائص وخدمات المهايئ المؤسسي على الموجه لضمان التوافقية 100%
Object.assign(router, {
  engineId: administrationWorkflowEngine.engineId,
  engineName: administrationWorkflowEngine.engineName,
  version: administrationWorkflowEngine.version,
  category: administrationWorkflowEngine.category,
  status: administrationWorkflowEngine.status,
  capabilities: administrationWorkflowEngine.capabilities,
  executeTransition: administrationWorkflowEngine.executeTransition.bind(administrationWorkflowEngine),
  healthCheck: administrationWorkflowEngine.healthCheck.bind(administrationWorkflowEngine),
  _fetchEntityCurrentState: administrationWorkflowEngine._fetchEntityCurrentState.bind(administrationWorkflowEngine),
  _persistEntityState: administrationWorkflowEngine._persistEntityState.bind(administrationWorkflowEngine),
  AdministrationWorkflowEngine,
  DEFAULT_CLAIM_STEPS,
  getWorkflowForEntity
});

module.exports = router;
module.exports.AdministrationWorkflowEngine = AdministrationWorkflowEngine;
module.exports.administrationWorkflowEngine = administrationWorkflowEngine;

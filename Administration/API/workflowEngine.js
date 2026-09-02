/**
 * Administration/API/workflowEngine.js
 * موجه محرك مسارات العمل وتدفق الموافقات المالية والهندسية (Role-Based Workflow Engine)
 * بلدية كفرنجة الجديدة - الإصدار الموحد v4.0
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const notificationCenter = require('../../services/notificationCenter');
const {
  dbGet,
  dbQuery,
  dbRun,
  isPostgresActive,
  getPool,
  memDb,
  saveMemTable
} = require('../../utils/database');

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

/**
 * 1. استعلام كافة مسارات العمل
 * GET /api/v4/workflows أو GET /api/workflows
 */
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

/**
 * 2. استعلام مراحل تدفق العمل القياسية
 * GET /api/v4/workflows/steps
 */
router.get('/steps', requireAuth, (req, res) => {
  res.json({ success: true, steps: DEFAULT_CLAIM_STEPS });
});

/**
 * 3. إنشاء مسار عمل جديد ديناميكياً (Zero-Code Workflow Creator)
 * POST /api/v4/workflows
 */
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

/**
 * 4. تعديل وتصميم مسار عمل وسلسلة اعتماده (Zero-Code Workflow Designer)
 * PUT /api/v4/workflows/:id
 */
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

/**
 * 5. حذف مسار عمل
 * DELETE /api/v4/workflows/:id
 */
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

/**
 * 6. استعلام مسار العمل الخاص بمطالبة معينة (Claims Workflow Status)
 * GET /api/v4/workflows/claims/:id
 */
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

/**
 * 7. ترقية المطالبة إلى الخطوة التالية (Next Step Action)
 * POST /api/v4/workflows/claims/:id/next-step
 */
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

          try {
            await client.query(`
              INSERT INTO enterprise.audit_logs (userId, action, entity, entityId, details)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              user.id,
              'تحديث مسار الموافقة',
              'claims',
              claimId,
              `تمرير المطالبة من ${currentStatus} إلى ${nextStatus} بواسطة ${user.fullName || user.username}`
            ]);
          } catch (auditErr) {}

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

    notificationCenter.emit('CLAIM_SUBMITTED', {
      tenderId: claim.tenderId || claim.id,
      amount: claim.netAmount || claim.amount || 0,
      userId: 'all',
      title: `ترقية مطالبة مالية (${claimId})`,
      type: 'info'
    });

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

router.DEFAULT_CLAIM_STEPS = DEFAULT_CLAIM_STEPS;
module.exports = router;

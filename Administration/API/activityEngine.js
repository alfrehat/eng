/**
 * Administration/API/activityEngine.js
 * محرك سجل الحركات والأنشطة والرقابة الشاملة (Comprehensive Audit Trail Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/rbacManager');
const {
  dbQuery,
  dbGet,
  dbRun,
  isPostgresActive,
  memDb,
  saveMemTable
} = require('../../utils/database');

function ensureActivityLogStorage() {
  if (!isPostgresActive()) {
    if (!memDb.activity_log) {
      memDb.activity_log = [];
      saveMemTable('activity_log');
    }
  }
}

/**
 * تنقية عميقة للبيانات الحساسة في حقل التفاصيل (Sensitive Data Redaction)
 */
function sanitizeDetails(details) {
  if (!details) return '';
  if (typeof details === 'object') {
    try {
      const clone = JSON.parse(JSON.stringify(details));
      const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'api_key', 'privatekey', 'password_hash'];
      const sanitizeObj = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        for (const key of Object.keys(obj)) {
          const lower = key.toLowerCase();
          if (sensitiveKeys.some(sk => lower.includes(sk))) {
            obj[key] = '***REDACTED***';
          } else if (typeof obj[key] === 'object') {
            sanitizeObj(obj[key]);
          }
        }
        return obj;
      };
      return JSON.stringify(sanitizeObj(clone));
    } catch {
      return String(details);
    }
  }
  let str = String(details);
  return str.replace(/"(password|token|secret|authorization|api_key|password_hash)"\s*:\s*"[^"]+"/gi, '"$1":"***REDACTED***"');
}

// 1. تسجيل نشاط جديد في النظام (داخلي أو عبر API أو خدمات النطاق)
async function recordActivity(payloadOrUserId, action, entity, entityId, details, ip, userAgent) {
  let opts = {};
  if (payloadOrUserId && typeof payloadOrUserId === 'object') {
    opts = payloadOrUserId;
  } else {
    opts = {
      userId: payloadOrUserId,
      userName: payloadOrUserId,
      action,
      entity,
      entityId,
      details,
      ip,
      userAgent
    };
  }

  ensureActivityLogStorage();
  const id = opts.id || ('ACT-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
  const now = new Date().toISOString();
  const clientIp = opts.ip || '127.0.0.1';
  const cleanDetails = sanitizeDetails(opts.details);

  const record = {
    id,
    userId: opts.userId || 'نظام',
    userName: opts.userName || opts.userId || 'مستخدم النظام',
    action: opts.action || 'إجراء',
    entity: opts.entity || 'عام',
    entityId: opts.entityId || '',
    details: cleanDetails,
    ip: clientIp,
    ip_address: clientIp,
    user_agent: opts.userAgent || '',
    createdAt: now,
    success: true
  };

  try {
    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO activity_log (
          id, "userId", "userName", action, entity, "entityId", details, ip_address, ip, user_agent, "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());
      `, [
        record.id, record.userId, record.userName, record.action,
        record.entity, record.entityId, record.details, record.ip_address, record.ip, record.user_agent
      ]);
    } else {
      // Memory fallback ONLY when PostgreSQL is NOT active
      if (!memDb.activity_log) memDb.activity_log = [];
      memDb.activity_log.unshift(record);
      if (memDb.activity_log.length > 500) memDb.activity_log.pop();
      saveMemTable('activity_log');
    }

    // بث حي فوري لمدراء النظام
    if (global.broadcastWs) {
      global.broadcastWs({
        type: 'NEW_ACTIVITY_LOG',
        data: record
      });
    }

    return record;
  } catch (err) {
    try {
      const { logError } = require('../../services/loggerService');
      logError('ACTIVITY_ENGINE', 'فشل كتابة سجل النشاط في قاعدة البيانات PostgreSQL', { error: err.message, recordId: record.id });
    } catch (_) {}
    console.error('Failed to record activity log:', err.message);
    // Strict failure semantics: no false success, no fallback to memDb on DB failure
    return {
      success: false,
      error: err.message,
      id: record.id
    };
  }
}

global.recordActivity = recordActivity;

// 2. استعلام سجل الحركات مع الفلترة والبحث المتقدم وحماية IDOR
router.get('/', requireAuth, async (req, res) => {
  ensureActivityLogStorage();
  try {
    const { action, userId, entity, search, limit = 100, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;

    // فحص الصلاحيات الإدارية لمنع ثغرة IDOR
    const userRole = (req.user?.role || '').toLowerCase();
    const isPrivileged = ['admin', 'super_admin', 'director', 'auditor'].includes(userRole) ||
      (req.user?.permissions && (
        req.user.permissions.includes('AUDIT.VIEW') ||
        req.user.permissions.includes('SETTINGS.MANAGE') ||
        req.user.permissions.includes('SETTINGS.VIEW') ||
        req.user.permissions.includes('*')
      ));

    // إذا لم يكن المستخدم صاحب صلاحية مراجعة، يتم حصره بسجلاته الشخصية حصراً
    const effectiveUserId = isPrivileged ? (userId || null) : (req.user?.id || req.user?.username);

    let logs = [];
    let totalCount = 0;

    if (isPostgresActive()) {
      let conditions = [];
      let params = [];

      if (action) {
        params.push(action);
        conditions.push(`action = $${params.length}`);
      }
      if (effectiveUserId) {
        params.push(effectiveUserId);
        conditions.push(`"userId" = $${params.length}`);
      }
      if (entity) {
        params.push(entity);
        conditions.push(`entity = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(details ILIKE $${params.length} OR "userName" ILIKE $${params.length} OR "entityId" ILIKE $${params.length})`);
      }

      const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const countRes = await dbGet(`SELECT count(*) as total FROM activity_log ${whereClause}`, params);
      totalCount = parseInt(countRes?.total || 0, 10);

      params.push(limitNum);
      const limitParamIdx = params.length;
      params.push(offsetNum);
      const offsetParamIdx = params.length;

      logs = await dbQuery(`
        SELECT id, "userId", "userName", action, entity, "entityId", details, 
               COALESCE(ip, ip_address, '127.0.0.1') as ip,
               COALESCE(ip_address, ip, '127.0.0.1') as ip_address,
               user_agent, "createdAt"
        FROM activity_log
        ${whereClause}
        ORDER BY "createdAt" DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      `, params);
    } else {
      let filtered = (memDb.activity_log || []);
      if (action) filtered = filtered.filter(l => l.action === action);
      if (effectiveUserId) filtered = filtered.filter(l => l.userId === effectiveUserId);
      if (entity) filtered = filtered.filter(l => l.entity === entity);
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(l =>
          (l.details && l.details.toLowerCase().includes(s)) ||
          (l.userName && l.userName.toLowerCase().includes(s)) ||
          (l.entityId && l.entityId.toLowerCase().includes(s))
        );
      }
      totalCount = filtered.length;
      logs = filtered.slice(offsetNum, offsetNum + limitNum);
    }

    // Support both direct array format and object format
    if (req.headers['accept-format'] === 'object' || req.query.format === 'object') {
      return res.json({
        success: true,
        count: logs.length,
        total: totalCount,
        data: logs
      });
    }

    // Default: returns array of logs with helper properties
    res.json(logs);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// 3. إضافة سجل نشاط يدوي من الواجهة
router.post('/', requireAuth, async (req, res) => {
  const { action, entity, entityId, details } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const record = await recordActivity({
    userId: req.user?.id || req.user?.username || 'user',
    userName: req.user?.fullName || req.user?.name || req.user?.username || 'مستخدم',
    action,
    entity,
    entityId,
    details,
    ip,
    userAgent
  });

  if (!record || record.success === false) {
    return res.status(500).json({ success: false, error: record?.error || 'فشل حفظ سجل النشاط' });
  }

  res.json({ success: true, data: record });
});

// 4. إحصائيات النشاط للوحة التحكم مع حماية الصلاحيات (RBAC/Scoping)
router.get('/stats', requireAuth, async (req, res) => {
  ensureActivityLogStorage();
  try {
    const userRole = (req.user?.role || '').toLowerCase();
    const isPrivileged = ['admin', 'super_admin', 'director', 'auditor'].includes(userRole) ||
      (req.user?.permissions && (
        req.user.permissions.includes('AUDIT.VIEW') ||
        req.user.permissions.includes('SETTINGS.MANAGE') ||
        req.user.permissions.includes('SETTINGS.VIEW') ||
        req.user.permissions.includes('*')
      ));

    const effectiveUserId = isPrivileged ? null : (req.user?.id || req.user?.username);

    let stats = {
      totalActions: 0,
      todayActions: 0,
      topActions: [],
      topUsers: []
    };

    if (isPostgresActive()) {
      if (effectiveUserId) {
        const total = await dbGet('SELECT count(*) as total FROM activity_log WHERE "userId" = $1', [effectiveUserId]);
        const today = await dbGet('SELECT count(*) as today FROM activity_log WHERE "userId" = $1 AND "createdAt" >= CURRENT_DATE', [effectiveUserId]);
        const byAction = await dbQuery('SELECT action, count(*) as count FROM activity_log WHERE "userId" = $1 GROUP BY action ORDER BY count DESC LIMIT 5', [effectiveUserId]);
        const byUser = await dbQuery('SELECT "userName", count(*) as count FROM activity_log WHERE "userId" = $1 GROUP BY "userName" ORDER BY count DESC LIMIT 5', [effectiveUserId]);

        stats.totalActions = parseInt(total?.total || 0, 10);
        stats.todayActions = parseInt(today?.today || 0, 10);
        stats.topActions = byAction;
        stats.topUsers = byUser;
      } else {
        const total = await dbGet('SELECT count(*) as total FROM activity_log');
        const today = await dbGet('SELECT count(*) as today FROM activity_log WHERE "createdAt" >= CURRENT_DATE');
        const byAction = await dbQuery('SELECT action, count(*) as count FROM activity_log GROUP BY action ORDER BY count DESC LIMIT 5');
        const byUser = await dbQuery('SELECT "userName", count(*) as count FROM activity_log GROUP BY "userName" ORDER BY count DESC LIMIT 5');

        stats.totalActions = parseInt(total?.total || 0, 10);
        stats.todayActions = parseInt(today?.today || 0, 10);
        stats.topActions = byAction;
        stats.topUsers = byUser;
      }
    } else {
      let all = memDb.activity_log || [];
      if (effectiveUserId) {
        all = all.filter(l => l.userId === effectiveUserId);
      }
      stats.totalActions = all.length;
      const todayStr = new Date().toISOString().slice(0, 10);
      stats.todayActions = all.filter(l => l.createdAt && l.createdAt.startsWith(todayStr)).length;
    }

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = {
  router,
  recordActivity
};

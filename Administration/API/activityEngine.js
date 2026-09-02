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

let isSchemaEnsured = false;
async function ensureActivityLogSchema() {
  if (isSchemaEnsured) return;
  if (isPostgresActive()) {
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id VARCHAR(100) PRIMARY KEY,
          "userId" VARCHAR(100),
          "userName" VARCHAR(255),
          action VARCHAR(100),
          entity VARCHAR(100),
          "entityId" VARCHAR(100),
          details TEXT,
          ip_address VARCHAR(100),
          user_agent TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS "userName" VARCHAR(255);
        ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
        ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
      `);
    } catch (e) {
      console.warn('Activity log schema note:', e.message);
    }
  }
  if (!memDb.activity_log) {
    memDb.activity_log = [];
    saveMemTable('activity_log');
  }
  isSchemaEnsured = true;
}

// 1. تسجيل نشاط جديد في النظام (داخلي أو عبر API)
async function recordActivity({ userId, userName, action, entity, entityId, details, ip, userAgent }) {
  await ensureActivityLogSchema();
  const id = 'ACT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();

  const record = {
    id,
    userId: userId || 'نظام',
    userName: userName || userId || 'مستخدم النظام',
    action: action || 'إجراء',
    entity: entity || 'عام',
    entityId: entityId || '',
    details: details || '',
    ip_address: ip || '127.0.0.1',
    user_agent: userAgent || '',
    createdAt: now
  };

  try {
    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO activity_log (
          id, "userId", "userName", action, entity, "entityId", details, ip_address, user_agent, "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
      `, [
        record.id, record.userId, record.userName, record.action,
        record.entity, record.entityId, record.details, record.ip_address, record.user_agent
      ]);
    }

    if (!memDb.activity_log) memDb.activity_log = [];
    memDb.activity_log.unshift(record);
    if (memDb.activity_log.length > 500) memDb.activity_log.pop();
    saveMemTable('activity_log');

    // بث حي فوري لمدراء النظام
    if (global.broadcastWs) {
      global.broadcastWs({
        type: 'NEW_ACTIVITY_LOG',
        data: record
      });
    }

    return record;
  } catch (err) {
    console.warn('Failed to record activity log:', err.message);
    return record;
  }
}

global.recordActivity = recordActivity;

// 2. استعلام سجل الحركات مع الفلترة والبحث المتقدم
router.get('/', requireAuth, async (req, res) => {
  await ensureActivityLogSchema();
  try {
    const { action, userId, entity, search, limit = 100, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;

    let logs = [];
    let totalCount = 0;

    if (isPostgresActive()) {
      let conditions = [];
      let params = [];

      if (action) {
        params.push(action);
        conditions.push(`action = $${params.length}`);
      }
      if (userId) {
        params.push(userId);
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
        SELECT id, "userId", "userName", action, entity, "entityId", details, ip_address, user_agent, "createdAt"
        FROM activity_log
        ${whereClause}
        ORDER BY "createdAt" DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      `, params);
    } else {
      let filtered = (memDb.activity_log || []);
      if (action) filtered = filtered.filter(l => l.action === action);
      if (userId) filtered = filtered.filter(l => l.userId === userId);
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

  res.json({ success: true, data: record });
});

// 4. إحصائيات النشاط للوحة التحكم
router.get('/stats', requireAuth, async (req, res) => {
  await ensureActivityLogSchema();
  try {
    let stats = {
      totalActions: 0,
      todayActions: 0,
      topActions: [],
      topUsers: []
    };

    if (isPostgresActive()) {
      const total = await dbGet('SELECT count(*) as total FROM activity_log');
      const today = await dbGet('SELECT count(*) as today FROM activity_log WHERE "createdAt" >= CURRENT_DATE');
      const byAction = await dbQuery('SELECT action, count(*) as count FROM activity_log GROUP BY action ORDER BY count DESC LIMIT 5');
      const byUser = await dbQuery('SELECT "userName", count(*) as count FROM activity_log GROUP BY "userName" ORDER BY count DESC LIMIT 5');

      stats.totalActions = parseInt(total?.total || 0, 10);
      stats.todayActions = parseInt(today?.today || 0, 10);
      stats.topActions = byAction;
      stats.topUsers = byUser;
    } else {
      const all = memDb.activity_log || [];
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

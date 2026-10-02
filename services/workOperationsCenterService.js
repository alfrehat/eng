/**
 * services/workOperationsCenterService.js
 * 🏛️ مركز العمل والمتابعة — النواة التشغيلية المعتمدة على Enterprise Core
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v4.0 - Anti-Gravity Enterprise Operations Patch
 */

'use strict';

const { dbQuery, dbRun, dbGet, withTransaction, isPostgresActive, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const notificationCenter = require('./notificationCenter');
const archiveEngineService = require('./archiveEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { logInfo, logError, logWarn } = require('./loggerService');

function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

class WorkOperationsCenterService {
  constructor() {
    this.engineId = 'OPERATIONS_CENTER';
    this.engineName = 'Enterprise Work Operations Center & Field Control Engine';
    this.aliasEngineId = 'TASKS_ENGINE';
    this.version = '4.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.tableName = 'tasks';

    this.ACTION_PERMISSION_MAP = {
      ASSIGN: ['OPERATIONS.ASSIGN', 'TASKS.ASSIGN', 'TASKS.CREATE', 'ADMIN'],
      REASSIGN: ['OPERATIONS.REASSIGN', 'TASKS.ASSIGN', 'ADMIN'],
      FORWARD: ['OPERATIONS.FORWARD', 'TASKS.EDIT', 'TASKS.ASSIGN', 'ADMIN'],
      RETURN: ['OPERATIONS.RETURN', 'TASKS.EDIT', 'TASKS.APPROVE', 'ADMIN'],
      ESCALATE: ['OPERATIONS.ESCALATE', 'TASKS.EDIT', 'ADMIN'],
      DELEGATE: ['OPERATIONS.DELEGATE', 'TASKS.ASSIGN', 'ADMIN'],
      ACCEPT: ['OPERATIONS.ACCEPT', 'TASKS.VIEW', 'ADMIN'],
      START: ['OPERATIONS.START', 'TASKS.EDIT', 'ADMIN'],
      SUBMIT: ['OPERATIONS.SUBMIT', 'TASKS.EDIT', 'ADMIN'],
      REVIEW: ['OPERATIONS.REVIEW', 'TASKS.APPROVE', 'ADMIN'],
      APPROVE: ['OPERATIONS.APPROVE', 'TASKS.APPROVE', 'ADMIN'],
      REJECT: ['OPERATIONS.REJECT', 'TASKS.APPROVE', 'ADMIN'],
      COMPLETE: ['OPERATIONS.COMPLETE', 'TASKS.EDIT', 'TASKS.APPROVE', 'ADMIN'],
      VERIFY: ['OPERATIONS.VERIFY', 'TASKS.APPROVE', 'ADMIN'],
      CLOSE: ['OPERATIONS.CLOSE', 'TASKS.APPROVE', 'ADMIN']
    };

    this.ACTION_STATE_MAP = {
      ASSIGN: 'assigned',
      REASSIGN: 'assigned',
      FORWARD: 'assigned',
      RETURN: 'returned',
      ESCALATE: 'under_review',
      DELEGATE: 'assigned',
      ACCEPT: 'in_progress',
      START: 'in_progress',
      SUBMIT: 'under_review',
      REVIEW: 'under_review',
      APPROVE: 'completed',
      REJECT: 'returned',
      COMPLETE: 'completed',
      VERIFY: 'verified',
      CLOSE: 'closed'
    };
  }

  _calculateSla(dueDateStr, status) {
    if (['completed', 'verified', 'closed', 'archived'].includes(status)) {
      return 'ON_TRACK';
    }
    if (!dueDateStr) return 'ON_TRACK';

    const now = new Date();
    const due = new Date(dueDateStr);
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 3600);

    if (diffHours < 0) return 'DELAYED';
    if (diffHours <= 24) return 'AT_RISK';
    return 'ON_TRACK';
  }

  /**
   * استخراج وتطبيع بنية العملية لضمان فك مصفوفات الـ JSON للواجهة
   */
  _formatOperationOutput(row) {
    if (!row) return null;
    const safeParse = (val, fallback) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch (e) { return fallback; }
    };

    return {
      ...row,
      sla_status: this._calculateSla(row.due_date, row.status),
      co_assignees: safeParse(row.co_assignees, []),
      subtasks: safeParse(row.subtasks, []),
      field_report: safeParse(row.field_report, {}),
      attachments: safeParse(row.attachments, []),
      comments: safeParse(row.comments, []),
      approvals: safeParse(row.approvals, []),
      assignment_history: safeParse(row.assignment_history, []),
      notes_and_endorsements: safeParse(row.notes_and_endorsements, []),
      entity_geometry: safeParse(row.entity_geometry, null),
      source_context: safeParse(row.source_context, {})
    };
  }

  /**
   * حل اسم المستخدم الصريح من المعرف
   */
  async _resolveUserName(userId) {
    if (!userId) return 'غير محدد';
    try {
      if (isPostgresActive()) {
        const u = await dbGet('SELECT "fullName", username FROM users WHERE id = $1', [userId]);
        if (u) return u.fullName || u.username;
      } else {
        const u = (memDb.users || []).find(x => x.id === userId || x.username === userId);
        if (u) return u.fullName || u.username;
      }
    } catch (e) {}
    return String(userId);
  }

  /**
   * استخراج معرف المدير أو المسؤول تلقائياً وديناميكياً من قاعدة البيانات
   */
  async _resolveDirectorOrAdminId() {
    try {
      if (isPostgresActive()) {
        const row = await dbGet("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'director_public_works') ORDER BY id ASC LIMIT 1");
        if (row && row.id) return row.id;
      } else {
        const u = (memDb.users || []).find(x => ['admin', 'super_admin', 'director_public_works'].includes(x.role));
        if (u && u.id) return u.id;
      }
    } catch (e) {}
    return 'U-001';
  }

  /**
   * تسجيل العمليات المؤسسية الحساسة في سجل التدقيق المركزي (Canonical Audit Writer)
   */
  async _recordAudit(userId, entityId, action, details, ip = '127.0.0.1') {
    try {
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'مركز العمل والمتابعة',
        entityId: String(entityId),
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ip
      });
    } catch (e) {
      logWarn('WorkOperationsCenterService', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * تقييم الصلاحيات الإدارية لعمليات الإسناد والتوجيه
   */
  async evaluateRoutingPermission(actor, action, currentOp, targetUser = null) {
    if (!actor) return { allowed: false, reason: 'المستخدم غير مصرح له (مطلوب جلسة نشطة)' };

    const aRole = String(actor.role || '').toLowerCase();
    if (aRole === 'admin' || aRole === 'super_admin' || aRole === 'director_public_works') {
      return { allowed: true };
    }

    const reqPerms = this.ACTION_PERMISSION_MAP[action] || [];
    let hasExplicitPerm = false;
    for (const p of reqPerms) {
      if (p === 'ADMIN') continue;
      if (rbacManager.hasPermission(actor, p)) {
        hasExplicitPerm = true;
        break;
      }
    }

    const isOwnerOrAssignee = currentOp && (currentOp.assigned_to === actor.id || currentOp.created_by === actor.id);
    const isSectionHead = actor.role && actor.role.startsWith('head_of_');

    if ((action === 'ACCEPT' || action === 'START' || action === 'SUBMIT') && isOwnerOrAssignee) {
      return { allowed: true };
    }

    if (isSectionHead) {
      if (['ASSIGN', 'REASSIGN', 'FORWARD', 'RETURN', 'REVIEW', 'APPROVE', 'ESCALATE', 'DELEGATE'].includes(action)) {
        return { allowed: true };
      }
    }

    if (['FORWARD', 'RETURN', 'ESCALATE', 'SUBMIT'].includes(action) && (isOwnerOrAssignee || hasExplicitPerm)) {
      return { allowed: true };
    }

    if (hasExplicitPerm) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `عذراً: الدور [${actor.role}] لا يملك صلاحية تنفيذ الإجراء [${action}] على العملية الحالية.`
    };
  }

  /**
   * إنشاء عملية مرتبطة بكيان أصلي
   */
  async createOperationFromEntity({ entityType, entityId, taskType, priority, assignedTo, dueDate, title, description, user }) {
    try {
      let entityName = '';
      let locationName = 'كفرنجة';
      let lat = 32.2985;
      let lng = 35.7050;
      let entityGeometry = null;
      let sourceContext = {};

      const normType = (entityType || '').toLowerCase().trim();

      if (normType === 'tender' || normType === 'tenders') {
        const rows = await dbQuery('SELECT id, name, "locationName", lat, lng FROM tenders WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].name || rows[0].id;
          locationName = rows[0].locationName || locationName;
          lat = rows[0].lat || lat;
          lng = rows[0].lng || lng;
          sourceContext = { tenderId: rows[0].id, tenderName: rows[0].name };
        }
      } else if (normType === 'project' || normType === 'projects') {
        const rows = await dbQuery('SELECT id, project_name, location, latitude, longitude FROM projects WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].project_name || rows[0].id;
          locationName = rows[0].location || locationName;
          lat = rows[0].latitude || lat;
          lng = rows[0].longitude || lng;
          sourceContext = { projectId: rows[0].id, projectName: rows[0].project_name };
        }
      } else if (normType === 'road' || normType === 'roads') {
        const rows = await dbQuery('SELECT id, name, code, start_lat, start_lng, coordinates FROM roads WHERE id = $1 OR code = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].name || rows[0].code || rows[0].id;
          locationName = `طريق: ${entityName}`;
          lat = rows[0].start_lat || lat;
          lng = rows[0].start_lng || lng;
          entityGeometry = rows[0].coordinates || null;
          sourceContext = { roadId: rows[0].id, roadCode: rows[0].code };
        }
      }

      const generatedTitle = title || `مهمة وإجراء ميداني لـ [${normType}]: ${entityName || entityId}`;

      return await this.createOperation({
        title: generatedTitle,
        description: description || `عملية منشأة ومرتبطة بـ ${normType} رقم [${entityId}]`,
        task_type: taskType || 'technical',
        priority: priority || 'medium',
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        entity_type: normType,
        entity_id: entityId,
        entity_name: entityName,
        location_name: locationName,
        lat,
        lng,
        entity_geometry: entityGeometry,
        source_context: sourceContext
      }, user);
    } catch (err) {
      logError('WorkOperationsCenterService.createOperationFromEntity', err.message);
      throw err;
    }
  }

  /**
   * استعلام مكاني متقدم: جلب المهام والأصول المجاورة
   */
  async getNearbySpatialContext({ lat, lng, radiusMeters = 500 }) {
    try {
      const qLat = parseFloat(lat);
      const qLng = parseFloat(lng);
      const radius = parseFloat(radiusMeters) || 500;

      if (isNaN(qLat) || isNaN(qLng)) {
        return { nearbyTasks: [], nearbyAssets: [], radiusMeters: radius };
      }

      const allTasks = await this.getOperations();
      const nearbyTasks = allTasks.filter(t => {
        if (!t.lat || !t.lng) return false;
        const d = calculateHaversineMeters(qLat, qLng, t.lat, t.lng);
        t.distanceMeters = Math.round(d);
        return d <= radius;
      });

      return {
        nearbyTasks: nearbyTasks.slice(0, 20),
        center: { lat: qLat, lng: qLng },
        radiusMeters: radius
      };
    } catch (err) {
      logError('WorkOperationsCenterService.getNearbySpatialContext', err.message);
      return { nearbyTasks: [], radiusMeters };
    }
  }

  /**
   * تنفيذ عمليات التوجيه والإسناد وتفعيل محرك الإشعارات الشامل
   */
  async executeRoutingAction({ opId, action, actor, targetUserId = null, remarks = '' }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية غير موجودة');

      const authDecision = await this.evaluateRoutingPermission(actor, action, existing, targetUserId);
      if (!authDecision.allowed) {
        throw new Error(authDecision.reason);
      }

      if (['APPROVE', 'CLOSE'].includes(action)) {
        const aRole = String(actor.role || '').toLowerCase();
        if (existing.created_by === actor.id && aRole !== 'admin' && aRole !== 'super_admin' && aRole !== 'director_public_works') {
          throw new Error('⛔ عذراً: تمنع قواعد فصل المهام (Separation of Duties) المستخدم من اعتماد أو إغلاق عملية قام بإنشائها بنفسه.');
        }
      }

      const actorId = actor.id || actor.username;
      const actorName = actor.fullName || actor.username;
      const actorRole = actor.role || 'user';

      const previousState = existing.status;
      const newState = this.ACTION_STATE_MAP[action] || previousState;
      let newAssignedTo = existing.assigned_to;

      if (['ASSIGN', 'REASSIGN', 'FORWARD', 'DELEGATE'].includes(action) && targetUserId) {
        newAssignedTo = targetUserId;
      } else if (action === 'ESCALATE') {
        newAssignedTo = targetUserId || (await this._resolveDirectorOrAdminId()) || existing.assigned_to;
      } else if (action === 'RETURN') {
        newAssignedTo = targetUserId || existing.created_by || existing.assigned_to;
      }

      const targetUserName = await this._resolveUserName(newAssignedTo);

      const historyEntry = {
        id: `ASG-${Date.now()}`,
        action,
        fromUserId: actorId,
        fromUserName: actorName,
        fromRole: actorRole,
        toUserId: newAssignedTo,
        toUserName: targetUserName,
        previousState,
        newState,
        reason: remarks || `تنفيذ إجراء [${action}]`,
        timestamp: new Date().toISOString()
      };

      const assignmentHistory = Array.isArray(existing.assignment_history) ? existing.assignment_history : [];
      assignmentHistory.push(historyEntry);

      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      comments.push({
        id: `ACT-${Date.now()}`,
        userId: actorId,
        userName: actorName,
        userRole: actorRole,
        text: `[${action}]: تحويل إلى ${targetUserName} ${remarks ? `— ملاحظات: ${remarks}` : ''}`,
        timestamp: new Date().toISOString()
      });

      let completedAt = existing.completed_at;
      let closedAt = existing.closed_at;

      if (['APPROVE', 'COMPLETE'].includes(action) && !completedAt) completedAt = new Date().toISOString();
      if (action === 'CLOSE' && !closedAt) closedAt = new Date().toISOString();

      const nowStr = new Date().toISOString();

      if (isPostgresActive()) {
        const sql = `
          UPDATE ${this.tableName} SET
            status = $1, assigned_to = $2, completed_at = $3, closed_at = $4,
            assignment_history = $5, comments = $6, updated_at = $7
          WHERE id = $8
        `;
        await dbRun(sql, [
          newState, newAssignedTo, completedAt, closedAt,
          JSON.stringify(assignmentHistory), JSON.stringify(comments), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx] = {
            ...memDb.tasks[idx],
            status: newState,
            assigned_to: newAssignedTo,
            completed_at: completedAt,
            closed_at: closedAt,
            assignment_history: assignmentHistory,
            comments: comments,
            updated_at: nowStr
          };
          saveMemTable('tasks');
        }
      }

      // إشعار سليم المعالم
      const notifRecipient = newAssignedTo || existing.created_by;
      if (notifRecipient && notifRecipient !== actorId) {
        notificationCenter.sendInternalAlert(
          `تحديث مسار العملية: [${existing.task_number}] تم توجيهها إليك من ${actorName}`,
          { userId: notifRecipient, action, entityId: existing.id }
        );
      }

      await this._recordAudit(actorId, existing.id, `OPERATION_ROUTED_${action}`, {
        action,
        fromUserId: actorId,
        toUserId: newAssignedTo,
        previousState,
        newState,
        remarks
      });

      return await this.getOperationById(existing.id);
    } catch (err) {
      logError('WorkOperationsCenterService.executeRoutingAction', err.message);
      throw err;
    }
  }

  /**
   * إضافة مشروحة / كشف هندسي / تنسيب رسمي مع تصحيح تمرير الإشعارات
   */
  async addEndorsementNote({ opId, noteText, recommendation = '', actionType = 'NOTE_ONLY', filesList = [], targetUserId = null, user }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية / الاستدعاء غير موجود');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';

      const attachedFiles = (filesList || []).map(file => ({
        id: file.id || `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: file.name || file.fileName || 'ملف مرفق',
        url: file.url || file.filePath || '',
        size: file.size || 0,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
        uploadedByName: userName
      }));

      const endorsementEntry = {
        id: `NOTE-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        userId,
        userName,
        userRole: user?.role || 'engineer',
        actionType: actionType || 'NOTE_ONLY',
        noteText: noteText || '',
        recommendation: recommendation || '',
        attachments: attachedFiles,
        createdAt: new Date().toISOString()
      };

      const currentNotes = Array.isArray(existing.notes_and_endorsements) ? existing.notes_and_endorsements : [];
      currentNotes.push(endorsementEntry);

      const currentAtts = Array.isArray(existing.attachments) ? existing.attachments : [];
      const mergedAtts = [...currentAtts, ...attachedFiles];

      let newAssignedTo = existing.assigned_to;
      let newStatus = existing.status;
      const history = Array.isArray(existing.assignment_history) ? existing.assignment_history : [];

      if (['ASSIGN', 'FORWARD', 'DELEGATE', 'ESCALATE', 'SUBMIT', 'RETURN'].includes(actionType)) {
        if (targetUserId) newAssignedTo = targetUserId;
        if (actionType === 'SUBMIT' || actionType === 'ESCALATE') newStatus = 'under_review';
        if (actionType === 'RETURN') newStatus = 'returned';

        const targetUserName = await this._resolveUserName(newAssignedTo);
        history.push({
          id: `ASG-${Date.now()}`,
          action: actionType,
          fromUserId: userId,
          fromUserName: userName,
          toUserId: newAssignedTo,
          toUserName: targetUserName,
          previousState: existing.status,
          newState: newStatus,
          reason: `مشروحة: ${recommendation || (noteText || '').substring(0, 80)}`,
          timestamp: new Date().toISOString()
        });

        // تصحيح استدعاء الإشعار الصريح
        if (newAssignedTo && newAssignedTo !== userId) {
          notificationCenter.sendInternalAlert(
            `مشروحة وتنسيب جديد: [${existing.task_number}] من ${userName}`,
            { userId: newAssignedTo, entityId: existing.id, action: actionType }
          );
        }
      }

      const nowStr = new Date().toISOString();

      if (isPostgresActive()) {
        const sql = `UPDATE ${this.tableName} SET notes_and_endorsements = $1, attachments = $2, assigned_to = $3, status = $4, assignment_history = $5, updated_at = $6 WHERE id = $7`;
        await dbRun(sql, [
          JSON.stringify(currentNotes), JSON.stringify(mergedAtts),
          newAssignedTo, newStatus, JSON.stringify(history), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx] = {
            ...memDb.tasks[idx],
            notes_and_endorsements: currentNotes,
            attachments: mergedAtts,
            assigned_to: newAssignedTo,
            status: newStatus,
            assignment_history: history,
            updated_at: nowStr
          };
          saveMemTable('tasks');
        }
      }

      await this._recordAudit(userId, existing.id, 'OPERATION_ENDORSED', {
        actionType,
        recommendation,
        noteLength: (noteText || '').length,
        filesCount: attachedFiles.length
      });

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.addEndorsementNote', e.message);
      throw e;
    }
  }

  /**
   * استرجاع العمليات مع فك مصفوفات الـ JSON ودعم التصفح
   */
  async getOperations(filters = {}, user = null) {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params = [];

      if (filters.status && filters.status !== 'all') {
        params.push(filters.status);
        query += ` AND status = $${params.length}`;
      }
      if (filters.priority && filters.priority !== 'all') {
        params.push(filters.priority);
        query += ` AND priority = $${params.length}`;
      }
      if (filters.task_type && filters.task_type !== 'all') {
        params.push(filters.task_type);
        query += ` AND task_type = $${params.length}`;
      }
      if (filters.assigned_to && filters.assigned_to !== 'all') {
        params.push(filters.assigned_to);
        query += ` AND assigned_to = $${params.length}`;
      }

      if (filters.search && filters.search.trim()) {
        params.push(`%${filters.search.trim()}%`);
        const pIdx = params.length;
        query += ` AND (title ILIKE $${pIdx} OR task_number ILIKE $${pIdx} OR citizen_name ILIKE $${pIdx} OR location_name ILIKE $${pIdx})`;
      }

      query += ` ORDER BY created_at DESC LIMIT 500`;

      let list = [];
      if (isPostgresActive()) {
        const rows = await dbQuery(query, params);
        list = Array.isArray(rows) ? rows : [];
      } else {
        list = (memDb.tasks || []).filter(item => {
          if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
          if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) return false;
          if (filters.task_type && filters.task_type !== 'all' && item.task_type !== filters.task_type) return false;
          if (filters.assigned_to && filters.assigned_to !== 'all' && item.assigned_to !== filters.assigned_to) return false;
          if (filters.search && !`${item.title || ''} ${item.task_number || ''} ${item.citizen_name || ''}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
          return true;
        });
      }

      return list.map(item => this._formatOperationOutput(item));
    } catch (err) {
      logError('WorkOperationsCenterService.getOperations', err.message);
      return [];
    }
  }

  async getOperationById(id) {
    try {
      let op = null;
      if (isPostgresActive()) {
        const rows = await dbQuery(
          `SELECT * FROM ${this.tableName} WHERE id = $1 OR task_number = $1 LIMIT 1`,
          [id]
        );
        op = rows && rows.length ? rows[0] : null;
      } else {
        op = (memDb.tasks || []).find(t => t.id === id || t.task_number === id) || null;
      }
      return this._formatOperationOutput(op);
    } catch (e) {
      logError('WorkOperationsCenterService.getOperationById', e.message);
      return null;
    }
  }

  async createOperation(data, user = null) {
    try {
      const taskNumber = data.task_number || await numberingEngine.generateNextId('tasks', { prefix: 'TSK' });
      const id = data.id || taskNumber;
      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'النظام المركزي';

      const initialComment = [{
        id: `ACT-${Date.now()}`,
        userId,
        userName,
        text: 'تم تسجيل وتكليف العملية رسمياً في مركز العمل والمتابعة',
        timestamp: new Date().toISOString()
      }];

      const initialHistory = [{
        id: `ASG-${Date.now()}`,
        action: 'ASSIGN',
        fromUserId: userId,
        fromUserName: userName,
        toUserId: data.assigned_to || null,
        toUserName: await this._resolveUserName(data.assigned_to),
        previousState: 'none',
        newState: data.status || 'new',
        reason: 'التكليف المبدئي عند إنشاء العملية',
        timestamp: new Date().toISOString()
      }];

      const row = {
        id,
        task_number: taskNumber,
        title: data.title,
        description: data.description || '',
        task_type: data.task_type || 'technical',
        priority: data.priority || 'medium',
        status: data.status || 'new',
        department_id: data.department_id || null,
        assigned_to: data.assigned_to || null,
        co_assignees: JSON.stringify(data.co_assignees || []),
        assigned_by: userId,
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date || null,
        completed_at: null,
        closed_at: null,
        planned_duration_hours: parseFloat(data.planned_duration_hours) || 24.0,
        actual_duration_hours: 0.0,
        sla_hours: parseFloat(data.sla_hours) || 48.0,
        sla_status: this._calculateSla(data.due_date, data.status || 'new'),
        entity_type: data.entity_type || null,
        entity_id: data.entity_id || null,
        entity_name: data.entity_name || '',
        location_name: data.location_name || 'كفرنجة',
        lat: data.lat !== undefined && data.lat !== null ? parseFloat(data.lat) : 32.2985,
        lng: data.lng !== undefined && data.lng !== null ? parseFloat(data.lng) : 35.7050,
        appeal_number: data.appeal_number || null,
        citizen_name: data.citizen_name || null,
        citizen_phone: data.citizen_phone || null,
        subtasks: JSON.stringify(data.subtasks || []),
        field_report: JSON.stringify(data.field_report || {}),
        attachments: JSON.stringify(data.attachments || []),
        comments: JSON.stringify(initialComment),
        approvals: JSON.stringify([]),
        assignment_history: JSON.stringify(initialHistory),
        notes_and_endorsements: JSON.stringify([]),
        entity_geometry: JSON.stringify(data.entity_geometry || null),
        source_context: JSON.stringify(data.source_context || {}),
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (isPostgresActive()) {
        const sql = `
          INSERT INTO ${this.tableName} (
            id, task_number, title, description, task_type, priority, status,
            department_id, assigned_to, co_assignees, assigned_by,
            start_date, due_date, completed_at, closed_at, planned_duration_hours, actual_duration_hours, sla_hours, sla_status,
            entity_type, entity_id, entity_name, location_name, lat, lng,
            appeal_number, citizen_name, citizen_phone,
            subtasks, field_report, attachments, comments, approvals, assignment_history, notes_and_endorsements,
            entity_geometry, source_context, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
            $37, $38, $39, $40
          )
        `;

        await dbRun(sql, [
          row.id, row.task_number, row.title, row.description, row.task_type, row.priority, row.status,
          row.department_id, row.assigned_to, row.co_assignees, row.assigned_by,
          row.start_date, row.due_date, row.completed_at, row.closed_at, row.planned_duration_hours, row.actual_duration_hours, row.sla_hours, row.sla_status,
          row.entity_type, row.entity_id, row.entity_name, row.location_name, row.lat, row.lng,
          row.appeal_number, row.citizen_name, row.citizen_phone,
          row.subtasks, row.field_report, row.attachments, row.comments, row.approvals, row.assignment_history, row.notes_and_endorsements,
          row.entity_geometry, row.source_context, row.created_by, row.created_at, row.updated_at
        ]);
      } else {
        if (!memDb.tasks) memDb.tasks = [];
        memDb.tasks.unshift(row);
        saveMemTable('tasks');
      }

      if (row.assigned_to) {
        notificationCenter.sendInternalAlert(
          `تم تكليفك بالعملية رقم [${row.task_number}]: ${row.title}`,
          { userId: row.assigned_to, entityId: row.id }
        );
      }

      await this._recordAudit(userId, row.id, 'OPERATION_CREATED', {
        task_number: row.task_number,
        title: row.title,
        assigned_to: row.assigned_to,
        priority: row.priority
      });

      return this._formatOperationOutput(row);
    } catch (err) {
      logError('WorkOperationsCenterService.createOperation', err.message);
      throw err;
    }
  }

  /**
   * فحص الازدواجية الدقيق مع استبعاد المواقع الافتراضية
   */
  async checkDuplicates({ location_name, entity_type, entity_id, lat, lng, citizen_name }) {
    try {
      const openOps = await this.getOperations();
      const duplicates = [];
      const queryLat = parseFloat(lat);
      const queryLng = parseFloat(lng);

      const isGenericLocation = (loc) => {
        if (!loc) return true;
        const l = loc.trim().toLowerCase();
        return l === 'كفرنجة' || l === 'بلدية كفرنجة' || l === 'بلدية كفرنجة الجديدة';
      };

      for (const op of openOps) {
        if (['completed', 'verified', 'closed', 'archived'].includes(op.status)) continue;
        let matchReason = null;

        if (citizen_name && op.citizen_name && citizen_name.trim().length >= 8 && citizen_name.trim() === op.citizen_name.trim()) {
          matchReason = `يوجد استدعاء نشط لنفس المواطن [${op.task_number}]: ${op.title}`;
        } else if (entity_type && entity_id && op.entity_type === entity_type && String(op.entity_id) === String(entity_id)) {
          matchReason = `توجد عملية نشطة بالفعل على نفس الكيان [${op.task_number}]: ${op.title}`;
        } else if (!isGenericLocation(location_name) && op.location_name && location_name.trim().toLowerCase() === op.location_name.trim().toLowerCase()) {
          matchReason = `يوجد عمل ميداني نشط في نفس الموقع المحدد [${op.task_number}]: ${op.location_name}`;
        } else if (!isNaN(queryLat) && !isNaN(queryLng) && op.lat && op.lng) {
          const dist = calculateHaversineMeters(queryLat, queryLng, op.lat, op.lng);
          if (dist < 60) {
            matchReason = `يوجد عمل ميداني نشط في نطاق مكاني مباشر (${Math.round(dist)}م) [${op.task_number}]`;
          }
        }

        if (matchReason) {
          duplicates.push({ opId: op.id, taskNumber: op.task_number, title: op.title, reason: matchReason });
        }
      }

      return { hasDuplicates: duplicates.length > 0, duplicates };
    } catch (e) {
      logError('WorkOperationsCenterService.checkDuplicates', e.message);
      return { hasDuplicates: false, duplicates: [] };
    }
  }

  /**
   * تعديل العملية بالصيغة المتوافقة تماماً مع PostgreSQL ($1, $2, ...)
   */
  async updateOperation(id, data, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const nowStr = new Date().toISOString();
      const updated = {
        ...existing,
        title: data.title !== undefined ? data.title : existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        priority: data.priority !== undefined ? data.priority : existing.priority,
        task_type: data.task_type !== undefined ? data.task_type : existing.task_type,
        location_name: data.location_name !== undefined ? data.location_name : existing.location_name,
        lat: data.lat !== undefined ? parseFloat(data.lat) : existing.lat,
        lng: data.lng !== undefined ? parseFloat(data.lng) : existing.lng,
        citizen_name: data.citizen_name !== undefined ? data.citizen_name : existing.citizen_name,
        citizen_phone: data.citizen_phone !== undefined ? data.citizen_phone : existing.citizen_phone,
        due_date: data.due_date !== undefined ? data.due_date : existing.due_date,
        assigned_to: data.assigned_to !== undefined ? data.assigned_to : existing.assigned_to,
        updated_at: nowStr
      };

      if (isPostgresActive()) {
        const sql = `
          UPDATE ${this.tableName} SET 
            title = $1, description = $2, priority = $3, task_type = $4,
            location_name = $5, lat = $6, lng = $7, citizen_name = $8, citizen_phone = $9,
            due_date = $10, assigned_to = $11, updated_at = $12
          WHERE id = $13
        `;
        await dbRun(sql, [
          updated.title, updated.description, updated.priority, updated.task_type,
          updated.location_name, updated.lat, updated.lng, updated.citizen_name, updated.citizen_phone,
          updated.due_date, updated.assigned_to, nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx] = { ...memDb.tasks[idx], ...updated };
          saveMemTable('tasks');
        }
      }

      await this._recordAudit(user?.id, existing.id, 'OPERATION_UPDATED', {
        updatedFields: Object.keys(data)
      });

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.updateOperation', e.message);
      throw e;
    }
  }

  /**
   * حذف العملية بالصيغة المتوافقة واستخدام المعاملة الذرية
   */
  async deleteOperation(id, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      if (isPostgresActive()) {
        await withTransaction(async (client) => {
          await client.run(`DELETE FROM ${this.tableName} WHERE id = $1`, [existing.id]);
        });
      } else {
        memDb.tasks = (memDb.tasks || []).filter(t => t.id !== existing.id);
        saveMemTable('tasks');
      }

      await this._recordAudit(user?.id, existing.id, 'OPERATION_DELETED', {
        task_number: existing.task_number,
        title: existing.title
      });

      return { success: true, id: existing.id, task_number: existing.task_number };
    } catch (e) {
      logError('WorkOperationsCenterService.deleteOperation', e.message);
      throw e;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // دوال التكامل ودعم واجهات المستخدم (WOC Engine API Compatibility Layer)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * توثيق تقرير الكشف الميداني
   */
  async saveFieldReport(id, fieldReport, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET field_report = $1, updated_at = $2 WHERE id = $3`, [
          JSON.stringify(fieldReport), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].field_report = fieldReport;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.saveFieldReport', e.message);
      throw e;
    }
  }

  /**
   * إضافة تعليق على العملية
   */
  async addComment(id, text, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';

      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      comments.push({
        id: `COM-${Date.now()}`,
        userId,
        userName,
        userRole: user?.role || 'user',
        text: text.trim(),
        timestamp: new Date().toISOString()
      });

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET comments = $1, updated_at = $2 WHERE id = $3`, [
          JSON.stringify(comments), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].comments = comments;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.addComment', e.message);
      throw e;
    }
  }

  /**
   * تحديث المهام الفرعية
   */
  async updateSubtasks(id, subtasks, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET subtasks = $1, updated_at = $2 WHERE id = $3`, [
          JSON.stringify(subtasks), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].subtasks = subtasks;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.updateSubtasks', e.message);
      throw e;
    }
  }

  /**
   * إضافة مرفقات إلى العملية
   */
  async addAttachments(id, filesList, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';

      const attachedFiles = (filesList || []).map(file => ({
        id: file.id || `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: file.name || file.fileName || 'ملف مرفق',
        url: file.url || file.filePath || '',
        size: file.size || 0,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
        uploadedByName: userName
      }));

      const current = Array.isArray(existing.attachments) ? existing.attachments : [];
      const merged = [...current, ...attachedFiles];

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET attachments = $1, updated_at = $2 WHERE id = $3`, [
          JSON.stringify(merged), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].attachments = merged;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.addAttachments', e.message);
      throw e;
    }
  }

  /**
   * حذف مرفق من العملية
   */
  async deleteAttachment(id, attachmentId) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const current = Array.isArray(existing.attachments) ? existing.attachments : [];
      const filtered = current.filter(a => a.id !== attachmentId && a.url !== attachmentId);

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET attachments = $1, updated_at = $2 WHERE id = $3`, [
          JSON.stringify(filtered), nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].attachments = filtered;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.deleteAttachment', e.message);
      throw e;
    }
  }

  /**
   * الاعتماد النهائي وتثبيت المعاملة
   */
  async finalizeAndApprove({ opId, decisionStatus = 'completed', decisionText = '', executionNotes = '', user }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'مدير المديرية';
      const uRole = String(user?.role || '').toLowerCase();

      // التحقق من قواعد فصل المهام والمسؤوليات (Separation of Duties)
      if (existing.created_by === userId && uRole !== 'admin' && uRole !== 'super_admin' && uRole !== 'director_public_works') {
        throw new Error('⛔ عذراً: تمنع قواعد فصل المهام (Separation of Duties) المستخدم من اعتماد أو إغلاق عملية قام بإنشائها بنفسه.');
      }

      const decision = {
        finalizedBy: userId,
        finalizedByName: userName,
        decisionText: decisionText || 'تم التدقيق والاعتماد النهائي والموافقة على التنسيبات المرفقة.',
        status: decisionStatus,
        executionNotes: executionNotes || '',
        finalizedAt: new Date().toISOString()
      };

      const history = Array.isArray(existing.assignment_history) ? existing.assignment_history : [];
      history.push({
        id: `ASG-${Date.now()}`,
        action: 'APPROVE',
        fromUserId: userId,
        fromUserName: userName,
        fromRole: user ? user.role : 'director_public_works',
        toUserId: existing.assigned_to,
        toUserName: await this._resolveUserName(existing.assigned_to),
        previousState: existing.status,
        newState: decisionStatus,
        reason: `الاعتماد النهائي وتثبيت المعاملة: ${decision.decisionText}`,
        timestamp: new Date().toISOString(),
        performedBy: userId
      });

      const nowStr = new Date().toISOString();
      if (isPostgresActive()) {
        await dbRun(`UPDATE ${this.tableName} SET final_decision = $1, status = $2, assignment_history = $3, completed_at = $4, updated_at = $5 WHERE id = $6`, [
          JSON.stringify(decision), decisionStatus, JSON.stringify(history), nowStr, nowStr, existing.id
        ]);
      } else {
        const idx = (memDb.tasks || []).findIndex(t => t.id === existing.id);
        if (idx !== -1) {
          memDb.tasks[idx].final_decision = decision;
          memDb.tasks[idx].status = decisionStatus;
          memDb.tasks[idx].assignment_history = history;
          memDb.tasks[idx].completed_at = nowStr;
          memDb.tasks[idx].updated_at = nowStr;
          saveMemTable('tasks');
        }
      }

      await this._recordAudit(userId, existing.id, 'OPERATION_FINALIZED', {
        decisionStatus,
        decisionText: decision.decisionText,
        finalizedAt: decision.finalizedAt
      });

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.finalizeAndApprove', e.message);
      throw e;
    }
  }

  /**
   * استخراج الإحصائيات التنفيذية لمركز العمل
   */
  async getExecutiveStats(user = null) {
    try {
      const all = await this.getOperations({}, user);
      const todayStr = new Date().toISOString().split('T')[0];

      const total = all.length;
      const today = all.filter(t => t.start_date === todayStr || t.due_date === todayStr).length;
      const open = all.filter(t => !['completed', 'verified', 'closed', 'archived'].includes(t.status)).length;
      const inProgress = all.filter(t => t.status === 'in_progress').length;
      const overdue = all.filter(t => t.due_date && t.due_date < todayStr && !['completed', 'verified', 'closed', 'archived'].includes(t.status)).length;
      const critical = all.filter(t => t.priority === 'critical' && !['completed', 'verified', 'closed', 'archived'].includes(t.status)).length;
      const underReview = all.filter(t => t.status === 'under_review').length;
      const awaitingClosure = all.filter(t => t.status === 'completed').length;
      const upcomingAppeals = all.filter(t => t.task_type === 'citizen_appeal' && t.due_date >= todayStr).length;
      const overdueAppeals = all.filter(t => t.task_type === 'citizen_appeal' && t.due_date < todayStr && !['completed', 'closed'].includes(t.status)).length;

      const completedCount = all.filter(t => ['completed', 'verified', 'closed'].includes(t.status)).length;
      const onTimeRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

      return {
        total, today, open, inProgress, overdue, critical,
        underReview, awaitingClosure, upcomingAppeals, overdueAppeals,
        completedCount, onTimeRate
      };
    } catch (e) {
      logError('WorkOperationsCenterService.getExecutiveStats', e.message);
      return {
        total: 0, today: 0, open: 0, inProgress: 0, overdue: 0, critical: 0,
        underReview: 0, awaitingClosure: 0, upcomingAppeals: 0, overdueAppeals: 0,
        completedCount: 0, onTimeRate: 100
      };
    }
  }

  async healthCheck() {
    let total = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        total = parseInt(res?.count || 0, 10);
      } else {
        total = (memDb.tasks || []).length;
      }
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        engineName: this.engineName,
        aliasEngineId: this.aliasEngineId,
        totalTasks: total,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: false,
        status: 'FAILED',
        engineId: this.engineId,
        error: e.message
      };
    }
  }
}

const workOperationsCenterService = new WorkOperationsCenterService();
module.exports = workOperationsCenterService;

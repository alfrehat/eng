/**
 * services/workOperationsCenterService.js
 * 🏛️ مركز العمل والمتابعة — النواة التشغيلية المعتمدة على Enterprise Core
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - الربط المؤسسي الكامل (Projects, Tenders, Contracts, Roads, Assets, GIS, Archive & Notification Engine)
 */

'use strict';

const { dbQuery, dbRun, isPostgresActive } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const notificationCenter = require('./notificationCenter');
const archiveEngineService = require('./archiveEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { logInfo, logError, logWarn } = require('./loggerService');

/**
 * حساب المسافة بين نقطتين جغرافيتين (Haversine بالمتر)
 */
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class WorkOperationsCenterService {
  constructor() {
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
   * تقييم الصلاحيات الإدارية والديناميكية لعمليات الإسناد والتوجيه
   */
  async evaluateRoutingPermission(actor, action, currentOp, targetUser = null) {
    if (!actor) return { allowed: false, reason: 'المستخدم غير مصرح له (مطلوب جلسة نشطة)' };

    if (actor.role === 'admin' || actor.id === 'U-001' || actor.role === 'director_public_works') {
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
   * إنشاء عملية / مهمة مرتبطة مباشرة بكيان أصلي في النظام (Enterprise Entity Binding)
   */
  async createOperationFromEntity({ entityType, entityId, taskType, priority, assignedTo, dueDate, title, description, user }) {
    try {
      let entityName = '';
      let locationName = 'بلدية كفرنجة الجديدة';
      let lat = 32.2985;
      let lng = 35.7050;
      let entityGeometry = null;
      let sourceContext = {};

      const normType = (entityType || '').toLowerCase().trim();

      // استرجاع بيانات الكيان الأصلي بالمعرف بدون تكرار الكود
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
        const rows = await dbQuery('SELECT id, name, location, lat, lng FROM projects WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].name || rows[0].id;
          locationName = rows[0].location || locationName;
          lat = rows[0].lat || lat;
          lng = rows[0].lng || lng;
          sourceContext = { projectId: rows[0].id, projectName: rows[0].name };
        }
      } else if (normType === 'contract' || normType === 'contracts') {
        const rows = await dbQuery('SELECT id, title, "contractorName" FROM contracts WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].title || rows[0].id;
          sourceContext = { contractId: rows[0].id, contractor: rows[0].contractorName };
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
      } else if (normType === 'building' || normType === 'structural_asset' || normType === 'structural_assets') {
        const rows = await dbQuery('SELECT id, name, location_name, lat, lng FROM assets_structural WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].name || rows[0].id;
          locationName = rows[0].location_name || locationName;
          lat = rows[0].lat || lat;
          lng = rows[0].lng || lng;
          sourceContext = { assetId: rows[0].id, assetType: 'structural' };
        }
      } else if (normType === 'electrical_asset' || normType === 'energy_assets') {
        const rows = await dbQuery('SELECT id, name, location_name, lat, lng FROM assets_energy WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].name || rows[0].id;
          locationName = rows[0].location_name || locationName;
          lat = rows[0].lat || lat;
          lng = rows[0].lng || lng;
          sourceContext = { assetId: rows[0].id, assetType: 'energy' };
        }
      } else if (normType === 'document' || normType === 'archive') {
        const rows = await dbQuery('SELECT id, title, "fileName", "filePath" FROM documents WHERE id = $1 LIMIT 1', [entityId]);
        if (rows && rows.length) {
          entityName = rows[0].title || rows[0].fileName || rows[0].id;
          sourceContext = { documentId: rows[0].id, fileName: rows[0].fileName, filePath: rows[0].filePath };
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
   * استعلام مكاني متقدم: جلب المهام والأصول والمشاريع المجاورة لنقطة جغرافية (GIS Proximity Engine)
   */
  async getNearbySpatialContext({ lat, lng, radiusMeters = 500 }) {
    try {
      const qLat = parseFloat(lat);
      const qLng = parseFloat(lng);
      const radius = parseFloat(radiusMeters) || 500;

      if (isNaN(qLat) || isNaN(qLng)) {
        return { nearbyTasks: [], nearbyAssets: [], nearbyProjects: [], radiusMeters: radius };
      }

      // 1. المهام المجاورة
      const allTasks = await this.getOperations();
      const nearbyTasks = allTasks.filter(t => {
        if (!t.lat || !t.lng) return false;
        const d = calculateHaversineMeters(qLat, qLng, t.lat, t.lng);
        t.distanceMeters = Math.round(d);
        return d <= radius;
      });

      // 2. الأصول المجاورة (طرق، أبنية، شبكات)
      let nearbyAssets = [];
      try {
        const structural = await dbQuery('SELECT id, name, asset_type, lat, lng, location_name FROM assets_structural WHERE lat IS NOT NULL AND lng IS NOT NULL') || [];
        const energy = await dbQuery('SELECT id, name, asset_type, lat, lng, location_name FROM assets_energy WHERE lat IS NOT NULL AND lng IS NOT NULL') || [];
        const combined = [...structural, ...energy];
        
        nearbyAssets = combined.filter(a => {
          const d = calculateHaversineMeters(qLat, qLng, a.lat, a.lng);
          a.distanceMeters = Math.round(d);
          return d <= radius;
        });
      } catch (e) {}

      // 3. المشاريع المجاورة
      let nearbyProjects = [];
      try {
        const projects = await dbQuery('SELECT id, name, code, lat, lng, location FROM projects WHERE lat IS NOT NULL AND lng IS NOT NULL') || [];
        nearbyProjects = projects.filter(p => {
          const d = calculateHaversineMeters(qLat, qLng, p.lat, p.lng);
          p.distanceMeters = Math.round(d);
          return d <= radius;
        });
      } catch (e) {}

      return {
        nearbyTasks: nearbyTasks.slice(0, 20),
        nearbyAssets: nearbyAssets.slice(0, 20),
        nearbyProjects: nearbyProjects.slice(0, 20),
        center: { lat: qLat, lng: qLng },
        radiusMeters: radius
      };
    } catch (err) {
      logError('WorkOperationsCenterService.getNearbySpatialContext', err.message);
      return { nearbyTasks: [], nearbyAssets: [], nearbyProjects: [], radiusMeters };
    }
  }

  /**
   * تنفيذ عمليات التوجيه والإسناد وتفعيل محرك الإشعارات الشامل
   */
  async executeRoutingAction({ opId, action, actor, targetUserId = null, remarks = '', plannedDurationHours = null }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية غير موجودة');

      const authDecision = await this.evaluateRoutingPermission(actor, action, existing, targetUserId);
      if (!authDecision.allowed) {
        throw new Error(authDecision.reason);
      }

      // فحص قاعدة فصل المهام (Separation of Duties - SoD)
      if (['APPROVE', 'CLOSE'].includes(action)) {
        if (existing.created_by === actor.id && actor.role !== 'admin' && actor.role !== 'director_public_works') {
          throw new Error('⛔ عذراً: تمنع قواعد فصل المهام (Separation of Duties) المستخدم من اعتماد أو إغلاق عملية قام بإنشائها بنفسه.');
        }
      }

      const actorId = actor.id || actor.username;
      const actorName = actor.fullName || actor.username;
      const actorRole = actor.role || 'user';

      let targetUser = null;
      if (targetUserId) {
        const uRows = await dbQuery('SELECT id, username, "fullName", role, department FROM users WHERE id = $1 LIMIT 1', [targetUserId]);
        if (uRows && uRows.length) targetUser = uRows[0];
      }

      const previousState = existing.status;
      const newState = this.ACTION_STATE_MAP[action] || previousState;
      let newAssignedTo = existing.assigned_to;

      if (['ASSIGN', 'REASSIGN', 'FORWARD', 'DELEGATE'].includes(action) && targetUserId) {
        newAssignedTo = targetUserId;
      } else if (action === 'ESCALATE') {
        newAssignedTo = targetUserId || 'U-002';
      } else if (action === 'RETURN') {
        newAssignedTo = targetUserId || existing.created_by || existing.assigned_to;
      }

      const historyEntry = {
        id: `ASG-${Date.now()}`,
        action,
        fromUserId: actorId,
        fromUserName: actorName,
        fromRole: actorRole,
        fromDepartment: actor.department || 'مديرية الأشغال',
        toUserId: targetUser ? targetUser.id : newAssignedTo,
        toUserName: targetUser ? (targetUser.fullName || targetUser.username) : this._getUserName(newAssignedTo),
        toRole: targetUser ? targetUser.role : 'user',
        toDepartment: targetUser ? targetUser.department : '',
        previousState,
        newState,
        reason: remarks || `تنفيذ إجراء [${action}]`,
        timestamp: new Date().toISOString(),
        performedBy: actorId
      };

      const assignmentHistory = Array.isArray(existing.assignment_history) ? existing.assignment_history : (typeof existing.assignment_history === 'string' ? JSON.parse(existing.assignment_history || '[]') : []);
      assignmentHistory.push(historyEntry);

      const comments = Array.isArray(existing.comments) ? existing.comments : (typeof existing.comments === 'string' ? JSON.parse(existing.comments || '[]') : []);
      comments.push({
        id: `ACT-${Date.now()}`,
        userId: actorId,
        userName: actorName,
        userRole: actorRole,
        text: `[${action}]: تحويل إلى ${historyEntry.toUserName} ${remarks ? `— ملاحظات: ${remarks}` : ''}`,
        timestamp: new Date().toISOString()
      });

      const approvals = Array.isArray(existing.approvals) ? existing.approvals : (typeof existing.approvals === 'string' ? JSON.parse(existing.approvals || '[]') : []);
      if (['APPROVE', 'REVIEW', 'VERIFY', 'CLOSE'].includes(action)) {
        approvals.push({
          step: action,
          userId: actorId,
          userName: actorName,
          userRole: actorRole,
          remarks,
          timestamp: new Date().toISOString()
        });
      }

      let completedAt = existing.completed_at;
      let closedAt = existing.closed_at;

      if (['APPROVE', 'COMPLETE'].includes(action) && !completedAt) {
        completedAt = new Date().toISOString();
      }
      if (action === 'CLOSE' && !closedAt) {
        closedAt = new Date().toISOString();
      }

      const sql = `
        UPDATE ${this.tableName} SET
          status = $1, assigned_to = $2, completed_at = $3, closed_at = $4,
          assignment_history = $5, comments = $6, approvals = $7, updated_at = $8
        WHERE id = $9
      `;

      await dbRun(sql, [
        newState, newAssignedTo, completedAt, closedAt,
        JSON.stringify(assignmentHistory), JSON.stringify(comments), JSON.stringify(approvals),
        new Date().toISOString(),
        existing.id
      ]);

      // بث الإشعارات عبر Notification Engine المركزي لكافة الحالات المعنية
      if (typeof notificationCenter.sendInternalAlert === 'function') {
        const notifRecipient = newAssignedTo || existing.created_by;
        if (notifRecipient && notifRecipient !== actorId) {
          const actionTitles = {
            ASSIGN: 'تكليف عمل جديد',
            REASSIGN: 'إعادة إسناد وتوجيه مهمة',
            FORWARD: 'إحالة وتوجيه عمل',
            RETURN: 'إرجاع عمل للتعديل والنواقص',
            ESCALATE: 'تنبيه: تم تصعيد العملية إدارياً',
            DELEGATE: 'تفويض مهمة عمل',
            SUBMIT: 'تم تقديم التقرير للاعتماد',
            APPROVE: 'اعتماد رسمي للعملية',
            COMPLETE: 'إنجاز العملية الميدانية',
            CLOSE: 'إغلاق وأرشفة رسمية'
          };
          notificationCenter.sendInternalAlert(`${actionTitles[action] || 'تحديث مسار العملية'}: [${existing.task_number}] من ${actorName}`, {
            userId: notifRecipient,
            type: `OPERATION_${action}`,
            entityId: existing.id,
            action,
            reason: remarks
          }).catch(() => null);
        }
      }

      // توثيق في سجل التدقيق العام
      if (global.recordActivity) {
        global.recordActivity({
          userId: actorId,
          userName: actorName,
          action: `إجراء مسار [${action}]`,
          entity: 'مركز العمل والمتابعة',
          entityId: existing.task_number,
          details: `من ${actorName} (${actorRole}) إلى ${historyEntry.toUserName} — ملاحظات: ${remarks}`
        });
      }

      return await this.getOperationById(existing.id);
    } catch (err) {
      logError('WorkOperationsCenterService.executeRoutingAction', err.message);
      throw err;
    }
  }

  /**
   * إضافة مشروحة / كشف هندسي / تنسيب رسمي مع المرفقات المباشرة
   */
  async addEndorsementNote({ opId, noteText, recommendation = '', actionType = 'NOTE_ONLY', filesList = [], targetUserId = null, user }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية / الاستدعاء غير موجود');

      const userId = user ? (user.id || user.username) : 'U-001';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';
      const userJobTitle = user ? (user.job_title || user.jobTitle || user.role) : 'مهندس';
      const userRole = user ? user.role : 'user';
      const department = user ? (user.department || 'مديرية الأشغال') : 'مديرية الأشغال';

      // 1. معالجة وفهرسة المرفقات التابعة لهذه المشروحة في Document Archive Engine
      const attachedFiles = [];
      for (const file of filesList) {
        const att = {
          id: file.id || `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          name: file.name || file.fileName || 'ملف مرفق',
          url: file.url || file.filePath || '',
          size: file.size || 0,
          type: file.type || file.mimeType || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
          uploadedByName: userName,
          parentEntity: existing.entity_type ? `${existing.entity_type}:${existing.entity_id}` : null
        };
        attachedFiles.push(att);

        if (typeof archiveEngineService.indexDocument === 'function') {
          archiveEngineService.indexDocument({
            title: `مرفق مشروحة: [${existing.task_number}] ${att.name}`,
            fileName: att.name,
            filePath: att.url,
            category: 'مركز العمل والمتابعة - مشروحات وكشوفات',
            subcategory: existing.task_type,
            entityType: 'tasks',
            entityId: existing.id,
            referenceNumber: existing.task_number,
            fileSize: att.size,
            fileType: att.type,
            uploadedBy: userId
          }, user).catch(() => null);
        }
      }

      // 2. إنشاء كائن المشروحة الموثق بالكامل
      const endorsementEntry = {
        id: `NOTE-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        userId,
        userName,
        userJobTitle,
        userRole,
        department,
        actionType: actionType || 'NOTE_ONLY',
        noteText: noteText || '',
        recommendation: recommendation || '',
        attachments: attachedFiles,
        createdAt: new Date().toISOString()
      };

      const currentNotes = Array.isArray(existing.notes_and_endorsements) 
        ? existing.notes_and_endorsements 
        : (typeof existing.notes_and_endorsements === 'string' ? JSON.parse(existing.notes_and_endorsements || '[]') : []);
      currentNotes.push(endorsementEntry);

      // دمج المرفقات أيضاً في قائمة المرفقات الكلية للعملية
      const currentAtts = Array.isArray(existing.attachments) 
        ? existing.attachments 
        : (typeof existing.attachments === 'string' ? JSON.parse(existing.attachments || '[]') : []);
      const mergedAtts = [...currentAtts, ...attachedFiles];

      // 3. إذا تضمنت المشروحة تحويلاً إدارياً (Transfer / Forward / Submit / Assign / Return)
      let newAssignedTo = existing.assigned_to;
      let newStatus = existing.status;
      const history = Array.isArray(existing.assignment_history) 
        ? existing.assignment_history 
        : (typeof existing.assignment_history === 'string' ? JSON.parse(existing.assignment_history || '[]') : []);

      if (['ASSIGN', 'FORWARD', 'DELEGATE', 'ESCALATE', 'SUBMIT', 'RETURN'].includes(actionType)) {
        if (targetUserId) newAssignedTo = targetUserId;
        else if (actionType === 'SUBMIT') newAssignedTo = 'U-003';
        else if (actionType === 'ESCALATE') newAssignedTo = 'U-002';
        else if (actionType === 'RETURN') newAssignedTo = existing.created_by || 'U-002';

        if (actionType === 'SUBMIT' || actionType === 'ESCALATE') newStatus = 'under_review';
        if (actionType === 'RETURN') newStatus = 'returned';

        let targetUser = null;
        if (newAssignedTo) {
          const uRows = await dbQuery('SELECT id, username, "fullName", role, department FROM users WHERE id = $1 LIMIT 1', [newAssignedTo]);
          if (uRows && uRows.length) targetUser = uRows[0];
        }

        history.push({
          id: `ASG-${Date.now()}`,
          action: actionType,
          fromUserId: userId,
          fromUserName: userName,
          fromRole: userRole,
          fromDepartment: department,
          toUserId: newAssignedTo,
          toUserName: targetUser ? (targetUser.fullName || targetUser.username) : this._getUserName(newAssignedTo),
          toRole: targetUser ? targetUser.role : 'user',
          toDepartment: targetUser ? targetUser.department : '',
          previousState: existing.status,
          newState: newStatus,
          reason: `مشروحة وتنسيب: ${recommendation || (noteText || '').substring(0, 100)}`,
          timestamp: new Date().toISOString(),
          performedBy: userId
        });

        // إشعار فوري
        if (typeof notificationCenter.sendInternalAlert === 'function' && newAssignedTo !== userId) {
          notificationCenter.sendInternalAlert({
            recipientId: newAssignedTo,
            type: 'TASK_ASSIGNED',
            title: `مشروحة وتحويل: [${existing.task_number}] من ${userName}`,
            message: `${recommendation ? `التنسيب: ${recommendation} | ` : ''}${(noteText || '').substring(0, 80)}`,
            entityType: 'tasks',
            entityId: existing.id
          }).catch(() => null);
        }
      }

      const sql = `UPDATE ${this.tableName} SET notes_and_endorsements = $1, attachments = $2, assigned_to = $3, status = $4, assignment_history = $5, updated_at = $6 WHERE id = $7`;
      await dbRun(sql, [
        JSON.stringify(currentNotes),
        JSON.stringify(mergedAtts),
        newAssignedTo,
        newStatus,
        JSON.stringify(history),
        new Date().toISOString(),
        existing.id
      ]);

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.addEndorsementNote', e.message);
      throw e;
    }
  }

  /**
   * الاعتماد النهائي وتثبيت المعاملة
   */
  async finalizeAndApprove({ opId, decisionText, decisionStatus = 'completed', executionNotes = '', user }) {
    try {
      const existing = await this.getOperationById(opId);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'U-001';
      const userName = user ? (user.fullName || user.username) : 'مدير المديرية';

      const decision = {
        finalizedBy: userId,
        finalizedByName: userName,
        decisionText: decisionText || 'تم التدقيق والاعتماد النهائي والموافقة على التنسيبات المرفقة.',
        status: decisionStatus,
        executionNotes: executionNotes || '',
        finalizedAt: new Date().toISOString()
      };

      const history = Array.isArray(existing.assignment_history) 
        ? existing.assignment_history 
        : (typeof existing.assignment_history === 'string' ? JSON.parse(existing.assignment_history || '[]') : []);

      history.push({
        id: `ASG-${Date.now()}`,
        action: 'APPROVE',
        fromUserId: userId,
        fromUserName: userName,
        fromRole: user ? user.role : 'director_public_works',
        fromDepartment: user ? user.department : 'مديرية الأشغال',
        toUserId: existing.assigned_to,
        toUserName: this._getUserName(existing.assigned_to),
        toRole: 'user',
        toDepartment: '',
        previousState: existing.status,
        newState: decisionStatus,
        reason: `الاعتماد النهائي وتثبيت المعاملة: ${decision.decisionText}`,
        timestamp: new Date().toISOString(),
        performedBy: userId
      });

      const sql = `UPDATE ${this.tableName} SET final_decision = $1, status = $2, assignment_history = $3, updated_at = $4 WHERE id = $5`;
      await dbRun(sql, [
        JSON.stringify(decision),
        decisionStatus,
        JSON.stringify(history),
        new Date().toISOString(),
        existing.id
      ]);

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.finalizeAndApprove', e.message);
      throw e;
    }
  }

  async getOperations(filters = {}, user = null) {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params = [];
      let pIdx = 1;

      // 0. تطبيق نطاق البيانات التنظيمي المعياري (Data Scope Enforcement)
      if (user && user.role !== 'admin' && user.id !== 'U-001' && user.role !== 'director_public_works') {
        const r = user.role || '';
        const uid = user.id || user.username || '';
        
        if (r === 'head_of_roads' || r === 'roads_engineer') {
          query += ` AND (department_id = 'roads' OR entity_type IN ('road', 'roads', 'paving', 'permits', 'tender', 'project') OR assigned_to = $${pIdx} OR created_by = $${pIdx} OR co_assignees::text ILIKE $${pIdx + 1})`;
          params.push(uid, `%"${uid}"%`);
          pIdx += 2;
        } else if (r === 'head_of_buildings' || r === 'buildings_engineer') {
          query += ` AND (department_id = 'buildings' OR entity_type IN ('building', 'structural_asset', 'structural_assets', 'tender', 'project') OR assigned_to = $${pIdx} OR created_by = $${pIdx} OR co_assignees::text ILIKE $${pIdx + 1})`;
          params.push(uid, `%"${uid}"%`);
          pIdx += 2;
        } else if (r === 'head_of_electricity_energy' || r === 'electrical_engineer' || r === 'renewable_energy_engineer' || r === 'electrical_works_inspector' || r === 'electrical_technician') {
          query += ` AND (department_id = 'energy' OR entity_type IN ('electrical_asset', 'energy_assets', 'solar', 'tender', 'project') OR assigned_to = $${pIdx} OR created_by = $${pIdx} OR co_assignees::text ILIKE $${pIdx + 1})`;
          params.push(uid, `%"${uid}"%`);
          pIdx += 2;
        } else {
          // Assignment Scope (المراقب، المساح، حاسب الكميات، وضبط الجودة)
          query += ` AND (assigned_to = $${pIdx} OR created_by = $${pIdx} OR co_assignees::text ILIKE $${pIdx + 1})`;
          params.push(uid, `%"${uid}"%`);
          pIdx += 2;
        }
      }

      if (filters.view_scope === 'my_tasks' && user && user.id) {
        query += ` AND (assigned_to = $${pIdx} OR assigned_by = $${pIdx} OR co_assignees::text ILIKE $${pIdx + 1})`;
        params.push(user.id, `%"${user.id}"%`);
        pIdx += 2;
      } else if (filters.view_scope === 'appeals') {
        query += ` AND (task_type IN ('citizen_appeal', 'summons') OR appeal_number IS NOT NULL)`;
      } else if (filters.view_scope === 'field_actions') {
        query += ` AND task_type IN ('executive_field', 'technical', 'emergency')`;
      } else if (filters.view_scope === 'overdue') {
        query += ` AND status NOT IN ('completed', 'verified', 'closed', 'archived') AND due_date < CURRENT_DATE`;
      } else if (filters.view_scope === 'review') {
        query += ` AND status = 'under_review'`;
      }

      if (filters.status && filters.status !== 'all') {
        query += ` AND status = $${pIdx++}`;
        params.push(filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        query += ` AND priority = $${pIdx++}`;
        params.push(filters.priority);
      }
      if (filters.task_type && filters.task_type !== 'all') {
        query += ` AND task_type = $${pIdx++}`;
        params.push(filters.task_type);
      }
      if (filters.assigned_to && filters.assigned_to !== 'all') {
        query += ` AND assigned_to = $${pIdx++}`;
        params.push(filters.assigned_to);
      }
      if (filters.entity_type && filters.entity_type !== 'all') {
        query += ` AND entity_type = $${pIdx++}`;
        params.push(filters.entity_type);
      }

      if (filters.search && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        query += ` AND (
          title ILIKE $${pIdx} OR
          task_number ILIKE $${pIdx} OR
          description ILIKE $${pIdx} OR
          location_name ILIKE $${pIdx} OR
          citizen_name ILIKE $${pIdx} OR
          appeal_number ILIKE $${pIdx} OR
          entity_name ILIKE $${pIdx}
        )`;
        params.push(s);
        pIdx++;
      }

      query += ` ORDER BY created_at DESC LIMIT 500`;

      const rows = await dbQuery(query, params);
      const list = Array.isArray(rows) ? rows : [];

      return list.map(item => ({
        ...item,
        sla_status: this._calculateSla(item.due_date, item.status)
      }));
    } catch (err) {
      logError('WorkOperationsCenterService.getOperations', err.message);
      return [];
    }
  }

  async getOperationById(id) {
    try {
      const rows = await dbQuery(
        `SELECT * FROM ${this.tableName} WHERE id = $1 OR task_number = $1 LIMIT 1`,
        [id]
      );
      if (!rows || !rows.length) return null;
      const op = rows[0];
      op.sla_status = this._calculateSla(op.due_date, op.status);
      return op;
    } catch (e) {
      logError('WorkOperationsCenterService.getOperationById', e.message);
      return null;
    }
  }

  async createOperation(data, user = null) {
    try {
      const id = data.id || `WOC-${Date.now()}`;
      
      let taskNumber = data.task_number;
      if (!taskNumber) {
        taskNumber = await numberingEngine.generateNextId('tasks', { prefix: 'TSK' });
      }

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'النظام المركزي';
      const userRole = user?.role || 'user';

      const initialComment = [{
        id: `ACT-${Date.now()}`,
        userId,
        userName,
        userRole,
        text: 'تم تسجيل وتكليف العملية رسمياً في مركز العمل والمتابعة',
        timestamp: new Date().toISOString()
      }];

      const initialHistory = [{
        id: `ASG-${Date.now()}`,
        action: 'ASSIGN',
        fromUserId: userId,
        fromUserName: userName,
        fromRole: userRole,
        fromDepartment: user?.department || 'مديرية الأشغال',
        toUserId: data.assigned_to || null,
        toUserName: this._getUserName(data.assigned_to),
        toRole: 'assigned_role',
        toDepartment: '',
        previousState: 'none',
        newState: data.status || 'new',
        reason: 'التكليف المبدئي عند إنشاء العملية',
        timestamp: new Date().toISOString(),
        performedBy: userId
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
        org_unit_id: data.org_unit_id || null,
        assigned_to: data.assigned_to || null,
        co_assignees: JSON.stringify(data.co_assignees || []),
        assigned_by: userId,
        assigned_team: data.assigned_team || '',
        external_entity: data.external_entity || '',
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
        location_name: data.location_name || 'بلدية كفرنجة الجديدة',
        lat: data.lat !== undefined && data.lat !== null ? parseFloat(data.lat) : 32.2985,
        lng: data.lng !== undefined && data.lng !== null ? parseFloat(data.lng) : 35.7050,
        appeal_number: data.appeal_number || null,
        appeal_date: data.appeal_date || null,
        citizen_name: data.citizen_name || null,
        citizen_phone: data.citizen_phone || null,
        national_id: data.national_id || null,
        subtasks: JSON.stringify(data.subtasks || []),
        field_report: JSON.stringify(data.field_report || {}),
        attachments: JSON.stringify(data.attachments || []),
        comments: JSON.stringify(initialComment),
        approvals: JSON.stringify([]),
        assignment_history: JSON.stringify(initialHistory),
        entity_geometry: JSON.stringify(data.entity_geometry || null),
        source_context: JSON.stringify(data.source_context || {}),
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const sql = `
        INSERT INTO ${this.tableName} (
          id, task_number, title, description, task_type, priority, status,
          department_id, org_unit_id, assigned_to, co_assignees, assigned_by, assigned_team, external_entity,
          start_date, due_date, completed_at, closed_at, planned_duration_hours, actual_duration_hours, sla_hours, sla_status,
          entity_type, entity_id, entity_name, location_name, lat, lng,
          appeal_number, appeal_date, citizen_name, citizen_phone, national_id,
          subtasks, field_report, attachments, comments, approvals, assignment_history,
          entity_geometry, source_context, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33,
          $34, $35, $36, $37, $38, $39,
          $40, $41, $42, $43, $44
        )
      `;

      await dbRun(sql, [
        row.id, row.task_number, row.title, row.description, row.task_type, row.priority, row.status,
        row.department_id, row.org_unit_id, row.assigned_to, row.co_assignees, row.assigned_by, row.assigned_team, row.external_entity,
        row.start_date, row.due_date, row.completed_at, row.closed_at, row.planned_duration_hours, row.actual_duration_hours, row.sla_hours, row.sla_status,
        row.entity_type, row.entity_id, row.entity_name, row.location_name, row.lat, row.lng,
        row.appeal_number, row.appeal_date, row.citizen_name, row.citizen_phone, row.national_id,
        row.subtasks, row.field_report, row.attachments, row.comments, row.approvals, row.assignment_history,
        row.entity_geometry, row.source_context, row.created_by, row.created_at, row.updated_at
      ]);

      if (row.assigned_to && typeof notificationCenter.sendInternalAlert === 'function') {
        notificationCenter.sendInternalAlert(`تم تكليفك بالعملية رقم [${row.task_number}]: ${row.title}`, {
          userId: row.assigned_to,
          type: 'TASK_ASSIGNED',
          entityId: row.id
        }).catch(() => null);
      }

      if (global.recordActivity) {
        global.recordActivity({
          userId,
          userName,
          action: 'تكليف وتسجيل عملية',
          entity: 'مركز العمل والمتابعة',
          entityId: row.task_number,
          details: `إنشاء وتكليف العملية: ${row.title} (${row.priority})`
        });
      }

      return {
        ...row,
        co_assignees: JSON.parse(row.co_assignees),
        subtasks: JSON.parse(row.subtasks),
        field_report: JSON.parse(row.field_report),
        attachments: JSON.parse(row.attachments),
        comments: JSON.parse(row.comments),
        approvals: JSON.parse(row.approvals),
        assignment_history: JSON.parse(row.assignment_history),
        entity_geometry: JSON.parse(row.entity_geometry || 'null'),
        source_context: JSON.parse(row.source_context || '{}')
      };
    } catch (err) {
      logError('WorkOperationsCenterService.createOperation', err.message);
      throw err;
    }
  }

  async saveFieldReport(id, reportData, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';

      const fieldReport = {
        completionPercentage: reportData.completionPercentage !== undefined ? parseInt(reportData.completionPercentage, 10) : 100,
        laborAndMachinery: reportData.laborAndMachinery || '',
        materialsAndQuantities: reportData.materialsAndQuantities || '',
        fieldNotes: reportData.fieldNotes || '',
        recordedBy: userName,
        recordedById: userId,
        recordedAt: new Date().toISOString()
      };

      const comments = Array.isArray(existing.comments) ? existing.comments : (typeof existing.comments === 'string' ? JSON.parse(existing.comments || '[]') : []);
      comments.push({
        id: `RPT-${Date.now()}`,
        userId,
        userName,
        userRole: user?.role || 'user',
        text: `تم توثيق تقرير الكشف الميداني بنسبة إنجاز (${fieldReport.completionPercentage}%)`,
        timestamp: new Date().toISOString()
      });

      const sql = `UPDATE ${this.tableName} SET field_report = $1, comments = $2, updated_at = $3 WHERE id = $4`;
      await dbRun(sql, [JSON.stringify(fieldReport), JSON.stringify(comments), new Date().toISOString(), existing.id]);

      if (global.recordActivity) {
        global.recordActivity({
          userId,
          userName,
          action: 'توثيق تقرير ميداني',
          entity: 'مركز العمل والمتابعة',
          entityId: existing.task_number,
          details: `إنجاز كشف ميداني بنسبة ${fieldReport.completionPercentage}%`
        });
      }

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.saveFieldReport', e.message);
      throw e;
    }
  }

  async addComment(id, text, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const userId = user ? (user.id || user.username) : 'SYSTEM';
      const userName = user ? (user.fullName || user.username) : 'المستخدم';

      const comments = Array.isArray(existing.comments) ? existing.comments : (typeof existing.comments === 'string' ? JSON.parse(existing.comments || '[]') : []);
      comments.push({
        id: `COM-${Date.now()}`,
        userId,
        userName,
        userRole: user?.role || 'user',
        text: text.trim(),
        timestamp: new Date().toISOString()
      });

      const sql = `UPDATE ${this.tableName} SET comments = $1, updated_at = $2 WHERE id = $3`;
      await dbRun(sql, [JSON.stringify(comments), new Date().toISOString(), existing.id]);

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.addComment', e.message);
      throw e;
    }
  }

  async updateSubtasks(id, subtasks, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const sql = `UPDATE ${this.tableName} SET subtasks = $1, updated_at = $2 WHERE id = $3`;
      await dbRun(sql, [JSON.stringify(subtasks), new Date().toISOString(), existing.id]);

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.updateSubtasks', e.message);
      throw e;
    }
  }

  async deleteAttachment(id, attachmentId) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const current = Array.isArray(existing.attachments) ? existing.attachments : (typeof existing.attachments === 'string' ? JSON.parse(existing.attachments || '[]') : []);
      const filtered = current.filter(a => a.id !== attachmentId && a.url !== attachmentId);

      const sql = `UPDATE ${this.tableName} SET attachments = $1, updated_at = $2 WHERE id = $3`;
      await dbRun(sql, [JSON.stringify(filtered), new Date().toISOString(), existing.id]);

      return await this.getOperationById(existing.id);
    } catch (e) {
      logError('WorkOperationsCenterService.deleteAttachment', e.message);
      throw e;
    }
  }

  async checkDuplicates({ location_name, entity_type, entity_id, lat, lng, citizen_name }) {
    try {
      const openOps = await dbQuery(
        `SELECT id, task_number, title, location_name, entity_type, lat, lng, status, citizen_name 
         FROM ${this.tableName} 
         WHERE status NOT IN ('completed', 'verified', 'closed', 'archived')`
      );
      if (!openOps || !openOps.length) return { hasDuplicates: false, duplicates: [] };

      const duplicates = [];
      const queryLat = parseFloat(lat);
      const queryLng = parseFloat(lng);

      for (const op of openOps) {
        let matchReason = null;

        if (citizen_name && op.citizen_name && citizen_name.trim() === op.citizen_name.trim()) {
          matchReason = `يوجد استدعاء مفتوح حالياً لنفس المواطن [${op.task_number}]: ${op.title}`;
        } else if (entity_type && entity_id && op.entity_type === entity_type && op.entity_id === entity_id) {
          matchReason = `توجد عملية نشطة بالفعل على نفس الكيان [${op.task_number}]: ${op.title}`;
        } else if (location_name && op.location_name && location_name.trim().toLowerCase() === op.location_name.trim().toLowerCase()) {
          matchReason = `يوجد بلاغ/كشف نشط في نفس الموقع الجغرافي [${op.task_number}]`;
        } else if (!isNaN(queryLat) && !isNaN(queryLng) && op.lat && op.lng) {
          const distanceMeters = calculateHaversineMeters(queryLat, queryLng, op.lat, op.lng);
          if (distanceMeters < 60) {
            matchReason = `يوجد عمل ميداني مفتوح في نطاق مكاني مباشر (${Math.round(distanceMeters)}م) [${op.task_number}]`;
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

  /**
   * تعديل وتحديث بيانات العملية أو الاستدعاء
   */
  async updateOperation(id, data, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      const title = data.title !== undefined ? data.title : existing.title;
      const description = data.description !== undefined ? data.description : existing.description;
      const priority = data.priority !== undefined ? data.priority : existing.priority;
      const task_type = data.task_type !== undefined ? data.task_type : existing.task_type;
      const location_name = data.location_name !== undefined ? data.location_name : existing.location_name;
      const lat = data.lat !== undefined ? data.lat : existing.lat;
      const lng = data.lng !== undefined ? data.lng : existing.lng;
      const citizen_name = data.citizen_name !== undefined ? data.citizen_name : existing.citizen_name;
      const citizen_phone = data.citizen_phone !== undefined ? data.citizen_phone : existing.citizen_phone;
      const appeal_number = data.appeal_number !== undefined ? data.appeal_number : existing.appeal_number;
      const due_date = data.due_date !== undefined ? data.due_date : existing.due_date;
      const assigned_to = data.assigned_to !== undefined ? data.assigned_to : existing.assigned_to;
      const entity_type = data.entity_type !== undefined ? data.entity_type : existing.entity_type;
      const entity_id = data.entity_id !== undefined ? data.entity_id : existing.entity_id;
      const entity_name = data.entity_name !== undefined ? data.entity_name : existing.entity_name;
      const updated_at = new Date().toISOString();

      await dbRun(
        `UPDATE ${this.tableName} SET 
          title = ?, description = ?, priority = ?, task_type = ?,
          location_name = ?, lat = ?, lng = ?, citizen_name = ?, citizen_phone = ?,
          appeal_number = ?, due_date = ?, assigned_to = ?, entity_type = ?,
          entity_id = ?, entity_name = ?, updated_at = ?
        WHERE id = ?`,
        [
          title, description, priority, task_type,
          location_name, lat, lng, citizen_name, citizen_phone,
          appeal_number, due_date, assigned_to, entity_type,
          entity_id, entity_name, updated_at, id
        ]
      );

      logInfo('WorkOperationsCenterService.updateOperation', `تم تحديث بيانات العملية [${existing.task_number || id}] بواسطة ${user?.fullName || user?.username}`);
      return await this.getOperationById(id);
    } catch (e) {
      logError('WorkOperationsCenterService.updateOperation', e.message);
      throw e;
    }
  }

  /**
   * حذف عملية أو استدعاء
   */
  async deleteOperation(id, user) {
    try {
      const existing = await this.getOperationById(id);
      if (!existing) throw new Error('العملية غير موجودة');

      await dbRun(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
      logInfo('WorkOperationsCenterService.deleteOperation', `تم حذف العملية [${existing.task_number || id}] بواسطة ${user?.fullName || user?.username}`);
      return { success: true, id, task_number: existing.task_number };
    } catch (e) {
      logError('WorkOperationsCenterService.deleteOperation', e.message);
      throw e;
    }
  }

  _getUserName(userId) {
    if (!userId) return 'غير محدد';
    return userId;
  }
}

const workOperationsCenterService = new WorkOperationsCenterService();
module.exports = workOperationsCenterService;

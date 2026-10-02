/**
 * services/tasksEngineService.js
 * 📋 محرك إدارة المهام والتهيئة التشغيلية الداخلية (TASKS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Tasks Management Patch
 */

'use strict';

const { isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const notificationCenter = require('./notificationCenter');
const { logInfo, logWarn, logError } = require('./loggerService');

class TasksEngineService {
  constructor() {
    this.engineId = 'TASKS_ENGINE';
    this.engineName = 'Enterprise Internal Tasks & Workflow Management Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'tasks_crud',
      'atomic_task_numbering',
      'assignee_notifications',
      'status_lifecycle',
      'dual_storage_persistence'
    ];
  }

  async _ensureTable() {
    // Schema is canonically enforced via migrations/000 and migrations/023
    return;
  }

  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء مهام البلدية [${action}] على المهمة [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const logId = `LOG-TSK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'إدارة المهام الداخلية',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('TasksEngine', `Audit log failed: ${e.message}`);
    }
  }

  _formatTaskOutput(row) {
    if (!row) return null;
    return {
      ...row,
      taskNumber: row.task_number || row.taskNumber || row.id,
      assignedTo: row.assigned_to || row.assignedTo || null,
      dueDate: row.due_date || row.dueDate || null
    };
  }

  /**
   * استرجاع قائمة المهام الداخلية مع الفلاتر والتصفح الآمن
   */
  async getTasks(filters = {}) {
    const { status, assignedTo, search, limit = 50 } = filters;

    if (isPostgresActive()) {
      await this._ensureTable();
      let sql = 'SELECT * FROM public.tasks WHERE 1=1';
      const params = [];

      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (assignedTo && assignedTo !== 'all') {
        params.push(assignedTo);
        sql += ` AND assigned_to = $${params.length}`;
      }
      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (title ILIKE $${params.length} OR task_number ILIKE $${params.length} OR description ILIKE $${params.length})`;
      }

      sql += ` ORDER BY created_at DESC LIMIT ${Math.max(1, parseInt(limit, 10))}`;
      const rows = await dbQuery(sql, params) || [];
      return rows.map(r => this._formatTaskOutput(r));
    } else {
      let list = (memDb.tasks || []).filter(t => {
        if (status && status !== 'all' && t.status !== status) return false;
        if (assignedTo && assignedTo !== 'all' && t.assigned_to !== assignedTo && t.assignedTo !== assignedTo) return false;
        if (search) {
          const sTarget = `${t.title || ''} ${t.task_number || t.taskNumber || ''} ${t.description || ''}`.toLowerCase();
          if (!sTarget.includes(search.toLowerCase())) return false;
        }
        return true;
      });

      return list.slice(0, parseInt(limit, 10)).map(t => this._formatTaskOutput(t));
    }
  }

  /**
   * استرجاع مهمة مفردة بالمعرف أو الرقم المرجعي
   */
  async getTaskById(taskId) {
    if (!taskId) return null;
    let task = null;

    if (isPostgresActive()) {
      await this._ensureTable();
      task = await dbGet('SELECT * FROM public.tasks WHERE id = $1 OR task_number = $1', [taskId]);
    } else {
      task = (memDb.tasks || []).find(t => String(t.id) === String(taskId) || String(t.task_number || t.taskNumber) === String(taskId)) || null;
    }

    return this._formatTaskOutput(task);
  }

  /**
   * إنشاء مهمة جديدة بالترقيم المؤسسي الموحد وتنبيه المكلف
   */
  async createTask(taskData, user = null) {
    const { title, description, assignedTo, assigned_to, dueDate, due_date, priority } = taskData;
    const taskTitle = title || 'مهمة إدارية جديدة';
    const assignee = assignedTo || assigned_to || null;
    const dDate = dueDate || due_date || null;
    const taskPriority = priority || 'MEDIUM';

    const id = await numberingEngine.generateNextId('tasks', { prefix: 'TSK' });
    const now = new Date().toISOString();

    const record = {
      id,
      task_number: id,
      title: taskTitle,
      description: description || '',
      assigned_to: assignee,
      due_date: dDate,
      priority: taskPriority,
      status: 'NEW',
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await this._ensureTable();
      await dbRun(`
        INSERT INTO public.tasks
        (id, task_number, title, description, assigned_to, due_date, priority, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        record.id, record.task_number, record.title, record.description,
        record.assigned_to, record.due_date, record.priority, record.status, record.created_by
      ]);
    } else {
      if (!memDb.tasks) memDb.tasks = [];
      memDb.tasks.unshift(record);
      saveMemTable('tasks');
    }

    if (assignee) {
      try {
        notificationCenter.sendInternalAlert(
          `📋 تم تكليفك بمهمة إدارية جديدة [${id}]: ${taskTitle}`,
          { userId: assignee, entityId: id, type: 'TASK_ASSIGNED' }
        );
      } catch (e) {}
    }

    await this._recordAudit(user?.id, id, 'TASK_CREATED', null, record);
    return this._formatTaskOutput(record);
  }

  /**
   * تحديث حالة أو تفاصيل المهمة
   */
  async updateTask(taskId, updates, user = null) {
    const existing = await this.getTaskById(taskId);
    if (!existing) throw new Error(`المهمة [${taskId}] غير موجودة.`);

    const actualId = existing.id;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };

    if (isPostgresActive()) {
      await this._ensureTable();
      await dbRun(`
        UPDATE public.tasks
        SET title = $1, description = $2, assigned_to = $3, due_date = $4, priority = $5, status = $6, updated_at = NOW()
        WHERE id = $7
      `, [
        updated.title, updated.description, updated.assigned_to || updated.assignedTo,
        updated.due_date || updated.dueDate, updated.priority, updated.status, actualId
      ]);
    } else {
      const idx = (memDb.tasks || []).findIndex(t => String(t.id) === String(actualId));
      if (idx !== -1) {
        memDb.tasks[idx] = { ...memDb.tasks[idx], ...updated };
        saveMemTable('tasks');
      }
    }

    await this._recordAudit(user?.id, actualId, 'TASK_UPDATED', existing, updated);
    return await this.getTaskById(actualId);
  }

  /**
   * حذف مهمة إدارية
   */
  async deleteTask(taskId, user = null) {
    const existing = await this.getTaskById(taskId);
    if (!existing) throw new Error(`المهمة [${taskId}] غير موجودة.`);

    const actualId = existing.id;
    if (isPostgresActive()) {
      await this._ensureTable();
      await dbRun('DELETE FROM public.tasks WHERE id = $1', [actualId]);
    } else {
      memDb.tasks = (memDb.tasks || []).filter(t => String(t.id) !== String(actualId));
      saveMemTable('tasks');
    }

    await this._recordAudit(user?.id, actualId, 'TASK_DELETED', existing, null);
    return { success: true, message: 'تم حذف المهمة بنجاح.' };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalTasks = 0;
    let openCount = 0;
    try {
      if (isPostgresActive()) {
        await this._ensureTable();
        const res = await dbGet("SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE status != 'CLOSED') as open FROM public.tasks");
        totalTasks = parseInt(res?.count || 0, 10);
        openCount = parseInt(res?.open || 0, 10);
      } else {
        const list = memDb.tasks || [];
        totalTasks = list.length;
        openCount = list.filter(t => t.status !== 'CLOSED').length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        engineName: this.engineName,
        version: this.version,
        totalTasksCount: totalTasks,
        openTasksCount: openCount,
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

module.exports = new TasksEngineService();

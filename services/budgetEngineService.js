/**
 * services/budgetEngineService.js
 * 💰 محرك الموازنة والبنود المالية والمخصصات (BUDGET_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Budget & Allocations Patch
 */

const { getPool, isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class BudgetEngineService {
  constructor() {
    this.engineId = 'BUDGET_ENGINE';
    this.engineName = 'Enterprise Budget Lines & Financial Allocations Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'budget_lines_management',
      'atomic_allocations',
      'commitment_tracking',
      'disbursement_lifecycle',
      'financial_reconciliation',
      'budget_ceiling_validation',
      'variance_analysis'
    ];
    this.initialized = false;
  }

  async init() {
    this._getLinesCollection();
    this._getAllocationsCollection();
    this.initialized = true;
  }

  _roundCurrency(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  _getLinesCollection() {
    if (!memDb.budget_lines && !memDb.directorate_budget_lines) {
      memDb.budget_lines = [];
      memDb.directorate_budget_lines = memDb.budget_lines;
    } else if (!memDb.budget_lines && memDb.directorate_budget_lines) {
      memDb.budget_lines = memDb.directorate_budget_lines;
    } else if (memDb.budget_lines && !memDb.directorate_budget_lines) {
      memDb.directorate_budget_lines = memDb.budget_lines;
    }
    return memDb.budget_lines;
  }

  _getAllocationsCollection() {
    if (!memDb.budget_allocations && !memDb.directorate_budget_allocations) {
      memDb.budget_allocations = [];
      memDb.directorate_budget_allocations = memDb.budget_allocations;
    } else if (!memDb.budget_allocations && memDb.directorate_budget_allocations) {
      memDb.budget_allocations = memDb.directorate_budget_allocations;
    } else if (memDb.budget_allocations && !memDb.directorate_budget_allocations) {
      memDb.directorate_budget_allocations = memDb.budget_allocations;
    }
    return memDb.budget_allocations;
  }

  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الموازنة المالية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const logId = 'LOG-BDG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الموازنة والبنود المالية',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('BudgetEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * استرجاع بنود الموازنة مع الأرصدة والمتبقيات وحساب المؤشرات
   */
  async getBudgetLines(filters = {}) {
    const fiscalYear = filters.fiscalYear || filters.year;
    const departmentId = filters.departmentId || filters.department;
    const { search, funding_source } = filters;

    let lines = [];
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = 'SELECT * FROM public.directorate_budget_lines WHERE 1=1';
        const params = [];
        if (fiscalYear) {
          params.push(String(fiscalYear));
          sql += ` AND (year = $${params.length} OR fiscal_year = $${params.length}::int)`;
        }
        if (departmentId) {
          params.push(departmentId);
          sql += ` AND (department = $${params.length} OR department_id = $${params.length})`;
        }
        if (funding_source) {
          params.push(funding_source);
          sql += ` AND funding_source = $${params.length}`;
        }
        if (search) {
          params.push(`%${search.trim()}%`);
          sql += ` AND (line_name ILIKE $${params.length} OR name ILIKE $${params.length} OR line_code ILIKE $${params.length} OR code ILIKE $${params.length})`;
        }
        sql += ' ORDER BY chapter_code ASC, line_code ASC, id ASC LIMIT 500';
        const res = await pool.query(sql, params);
        lines = res.rows || [];
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL getBudgetLines query failed: ${e.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${e.message}`);
      }
    } else {
      const list = this._getLinesCollection();
      lines = list.filter(b => {
        if (fiscalYear && String(b.fiscal_year || b.fiscalYear || b.year) !== String(fiscalYear)) return false;
        if (departmentId && (b.department_id || b.departmentId || b.department) !== departmentId) return false;
        if (funding_source && b.funding_source !== funding_source) return false;
        if (search) {
          const s = search.toLowerCase();
          const nameMatch = (b.name || b.line_name || '').toLowerCase().includes(s);
          const codeMatch = (b.code || b.line_code || '').toLowerCase().includes(s);
          if (!nameMatch && !codeMatch) return false;
        }
        return true;
      });
    }

    // احتساب الالتزامات والصرف الفعلي لكل بند
    for (const line of lines) {
      const allocatedVal = parseFloat(line.allocated_amount || line.total_amount || 0);
      const metrics = await this.calculateLineMetrics(line.id, allocatedVal);
      line.line_name = line.line_name || line.name || 'بند مالي';
      line.line_code = line.line_code || line.code || line.id;
      line.year = line.year || (line.fiscal_year ? String(line.fiscal_year) : new Date().getFullYear().toString());
      line.committed_amount = metrics.committed;
      line.spent_amount = metrics.spent;
      line.remaining_amount = Math.max(0, this._roundCurrency(allocatedVal - metrics.spent));
      line.available_commitment = Math.max(0, this._roundCurrency(allocatedVal - metrics.committed));
      line.spent_percentage = allocatedVal > 0 
        ? Math.min(100, Math.round((metrics.spent / allocatedVal) * 100)) 
        : 0;
      line.commitment_percentage = allocatedVal > 0 
        ? Math.min(100, Math.round((metrics.committed / allocatedVal) * 100)) 
        : 0;
    }

    return lines;
  }

  async getBudgetLineById(id) {
    if (!id) return null;
    let line = null;
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('SELECT * FROM public.directorate_budget_lines WHERE id = $1 OR line_code = $1', [id]);
        line = res.rows && res.rows.length > 0 ? res.rows[0] : null;
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL getBudgetLineById query failed: ${e.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${e.message}`);
      }
    } else {
      const lines = this._getLinesCollection();
      line = lines.find(l => String(l.id) === String(id) || String(l.line_code || l.code) === String(id));
    }
    if (!line) return null;

    const allocatedVal = parseFloat(line.allocated_amount || line.total_amount || 0);
    const metrics = await this.calculateLineMetrics(line.id, allocatedVal);
    line.line_name = line.line_name || line.name;
    line.line_code = line.line_code || line.code || line.id;
    line.year = line.year || (line.fiscal_year ? String(line.fiscal_year) : new Date().getFullYear().toString());
    line.committed_amount = metrics.committed;
    line.spent_amount = metrics.spent;
    line.remaining_amount = Math.max(0, this._roundCurrency(allocatedVal - metrics.spent));
    line.available_commitment = Math.max(0, this._roundCurrency(allocatedVal - metrics.committed));

    return line;
  }

  async createBudgetLine(data, user = null) {
    const lineName = data.line_name || data.name;
    const allocatedAmount = this._roundCurrency(data.allocated_amount || data.total_amount || 0);
    if (!lineName || isNaN(allocatedAmount) || allocatedAmount <= 0) {
      throw new Error('اسم البند وقيمة المخصص المالي حقول إلزامية وتتطلب قيمة رقمية موجبة أكبر من الصفر.');
    }

    const year = (data.year || data.fiscal_year || data.fiscalYear || new Date().getFullYear()).toString();
    const id = data.id || await numberingEngine.generateNextId('budget_lines', { prefix: 'BL', year: parseInt(year, 10) });
    const chapterCode = data.chapter_code || data.chapterCode || '211';
    const chapterName = data.chapter_name || data.chapterName || 'نفقات المشاريع الرأسمالية';
    const lineCode = data.line_code || data.code || id;
    const fundingSource = data.funding_source || data.fundingSource || 'موازنة البلدية الذاتية';
    const department = data.department || data.departmentId || 'مديرية الأشغال والخدمات الهندسية';
    const departmentId = data.departmentId || data.department_id || 'DIR-ENG';
    const notes = data.notes || '';
    const now = new Date().toISOString();

    const record = {
      id,
      year,
      fiscal_year: parseInt(year, 10),
      chapter_code: chapterCode,
      chapter_name: chapterName,
      line_code: lineCode,
      code: lineCode,
      line_name: lineName,
      name: lineName,
      allocated_amount: allocatedAmount,
      total_amount: allocatedAmount,
      funding_source: fundingSource,
      department,
      department_id: departmentId,
      notes,
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(`
          INSERT INTO public.directorate_budget_lines (
            id, year, fiscal_year, chapter_code, chapter_name, line_code, code,
            line_name, name, allocated_amount, total_amount, funding_source,
            department, department_id, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        `, [
          id, year, parseInt(year, 10), chapterCode, chapterName, lineCode, lineCode,
          lineName, lineName, allocatedAmount, allocatedAmount, fundingSource,
          department, departmentId, notes
        ]);
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL insert budget line failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      }
    }

    const lines = this._getLinesCollection();
    const existingIdx = lines.findIndex(l => l.id === id);
    if (existingIdx >= 0) lines[existingIdx] = record;
    else lines.unshift(record);
    saveMemTable('directorate_budget_lines');
    saveMemTable('budget_lines');

    await this._recordAudit(user?.id, id, 'BUDGET_LINE_CREATED', null, record);
    return await this.getBudgetLineById(id);
  }

  async updateBudgetLine(id, data, user = null) {
    const existing = await this.getBudgetLineById(id);
    if (!existing) throw new Error(`بند الموازنة [${id}] غير موجود.`);

    const allocatedAmount = data.allocated_amount !== undefined 
      ? this._roundCurrency(data.allocated_amount) 
      : this._roundCurrency(existing.allocated_amount || existing.total_amount);
    if (isNaN(allocatedAmount) || allocatedAmount <= 0) {
      throw new Error('قيمة المخصص المالي يجب أن تكون قيمة رقمية موجبة أكبر من الصفر.');
    }

    const year = (data.year || data.fiscal_year || existing.year || existing.fiscal_year).toString();
    const chapterCode = data.chapter_code || existing.chapter_code;
    const chapterName = data.chapter_name || existing.chapter_name;
    const lineCode = data.line_code || data.code || existing.line_code || existing.code;
    const lineName = data.line_name || data.name || existing.line_name || existing.name;
    const fundingSource = data.funding_source || existing.funding_source;
    const department = data.department || existing.department;
    const departmentId = data.departmentId || data.department_id || existing.department_id || 'DIR-ENG';
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const now = new Date().toISOString();

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query(`
          UPDATE public.directorate_budget_lines SET
            year = $1, fiscal_year = $2, chapter_code = $3, chapter_name = $4,
            line_code = $5, code = $6, line_name = $7, name = $8,
            allocated_amount = $9, total_amount = $10, funding_source = $11,
            department = $12, department_id = $13, notes = $14, updated_at = NOW()
          WHERE id = $15
        `, [
          year, parseInt(year, 10), chapterCode, chapterName, lineCode, lineCode,
          lineName, lineName, allocatedAmount, allocatedAmount, fundingSource,
          department, departmentId, notes, id
        ]);
        if (res.rowCount === 0) {
          throw new Error(`تعذر العثور على بند الموازنة [${id}] لتحديثه.`);
        }
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL update budget line failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      }
    }

    const lines = this._getLinesCollection();
    const idx = lines.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
      lines[idx] = {
        ...lines[idx],
        year,
        fiscal_year: parseInt(year, 10),
        chapter_code: chapterCode,
        chapter_name: chapterName,
        line_code: lineCode,
        code: lineCode,
        line_name: lineName,
        name: lineName,
        allocated_amount: allocatedAmount,
        total_amount: allocatedAmount,
        funding_source: fundingSource,
        department,
        department_id: departmentId,
        notes,
        updated_at: now
      };
      saveMemTable('directorate_budget_lines');
      saveMemTable('budget_lines');
    }

    await this._recordAudit(user?.id, id, 'BUDGET_LINE_UPDATED', existing, { lineName, allocatedAmount });
    return await this.getBudgetLineById(id);
  }

  async deleteBudgetLine(id, user = null) {
    const existing = await this.getBudgetLineById(id);
    if (!existing) throw new Error(`بند الموازنة [${id}] غير موجود.`);

    if (isPostgresActive()) {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM public.directorate_budget_allocations WHERE budget_line_id = $1', [id]);
        const delRes = await client.query('DELETE FROM public.directorate_budget_lines WHERE id = $1', [id]);
        if (delRes.rowCount === 0) {
          throw new Error(`تعذر حذف بند الموازنة [${id}].`);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        logError('BudgetEngine', `PostgreSQL delete budget line failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      } finally {
        client.release();
      }
    }

    const lines = this._getLinesCollection();
    const allocations = this._getAllocationsCollection();
    
    const remainingLines = lines.filter(l => String(l.id) !== String(id));
    const remainingAllocs = allocations.filter(a => String(a.budget_line_id) !== String(id));
    
    memDb.budget_lines = remainingLines;
    memDb.directorate_budget_lines = remainingLines;
    memDb.budget_allocations = remainingAllocs;
    memDb.directorate_budget_allocations = remainingAllocs;
    
    saveMemTable('directorate_budget_lines');
    saveMemTable('budget_lines');
    saveMemTable('directorate_budget_allocations');
    saveMemTable('budget_allocations');

    await this._recordAudit(user?.id, id, 'BUDGET_LINE_DELETED', null, { id });
    return { success: true, message: 'تم حذف بند الموازنة بنجاح' };
  }

  /**
   * حجز مخصص مالي للبند بطريقة ذرية تمنع تجاوز السقف
   */
  async createAllocation(allocationData, user = null) {
    const { budget_line_id, budgetLineId, entity_type, entityType, entity_id, entityId, entity_name, entityName, amount, status } = allocationData || {};
    const bId = budget_line_id || budgetLineId;
    const eType = (entity_type || entityType || 'GENERAL').toUpperCase();
    const eId = entity_id || entityId || `ENT-${Date.now()}`;
    const eName = entity_name || entityName || 'ارتباط مالي';
    const reqAmount = this._roundCurrency(amount);

    if (!bId) throw new Error('معرف البند المالي (budget_line_id) حقل إلزامي.');
    if (isNaN(reqAmount) || reqAmount <= 0) {
      throw new Error('مبلغ الحجز المالي يجب أن يكون قيمة رقمية موجبة أكبر من الصفر.');
    }

    const allocationId = await numberingEngine.generateNextId('budget_allocations', { prefix: 'ALC', year: new Date().getFullYear() });
    const recStatus = status || 'COMMITTED';

    if (isPostgresActive()) {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // قفل ذري للـ Row لمنع السباق (Race Condition Lock)
        const lineRes = await client.query('SELECT * FROM public.directorate_budget_lines WHERE id = $1 FOR UPDATE', [bId]);
        if (!lineRes || lineRes.rows.length === 0) throw new Error(`البند المالي [${bId}] غير موجود.`);
        
        const line = lineRes.rows[0];
        const allocatedRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0) as total FROM public.directorate_budget_allocations WHERE budget_line_id = $1 AND status != 'RELEASED'",
          [bId]
        );
        const currentAllocated = parseFloat(allocatedRes.rows[0].total || 0);
        const totalLimit = parseFloat(line.allocated_amount || line.total_amount || 0);
        const remaining = this._roundCurrency(totalLimit - currentAllocated);

        if (reqAmount > remaining) {
          throw new Error(`مخصص غير كافٍ في البند [${line.code || line.line_code || ''} - ${line.name || line.line_name || ''}]. المتاح: ${remaining.toLocaleString('ar-JO')} د.أ، والمطلوب: ${reqAmount.toLocaleString('ar-JO')} د.أ.`);
        }

        await client.query(`
          INSERT INTO public.directorate_budget_allocations
          (id, budget_line_id, entity_type, entity_id, entity_name, amount, status, notes, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [allocationId, bId, eType, eId, eName, reqAmount, recStatus, allocationData?.notes || '', user?.id || 'SYSTEM']);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        logError('BudgetEngine', `PostgreSQL allocation failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      } finally {
        client.release();
      }
    } else {
      const lines = this._getLinesCollection();
      const allocations = this._getAllocationsCollection();
      const line = lines.find(b => String(b.id) === String(bId));
      if (!line) throw new Error(`البند المالي [${bId}] غير موجود.`);

      const currentAllocated = allocations
        .filter(a => (String(a.budget_line_id) === String(bId) || String(a.budgetLineId) === String(bId)) && a.status !== 'RELEASED')
        .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      const totalLimit = parseFloat(line.allocated_amount || line.total_amount || 0);
      const remaining = this._roundCurrency(totalLimit - currentAllocated);

      if (reqAmount > remaining) {
        throw new Error(`مخصص غير كافٍ في البند المالي. المتاح: ${remaining} د.أ، والمطلوب: ${reqAmount} د.أ.`);
      }
    }

    const allocations = this._getAllocationsCollection();
    const record = {
      id: allocationId,
      budget_line_id: bId,
      entity_type: eType,
      entity_id: eId,
      entity_name: eName,
      amount: reqAmount,
      status: recStatus,
      created_at: new Date().toISOString()
    };
    allocations.push(record);
    saveMemTable('directorate_budget_allocations');
    saveMemTable('budget_allocations');
    await this._recordAudit(user?.id, allocationId, 'BUDGET_ALLOCATION_CREATED', null, { bId, eType, eId, reqAmount });
    return { success: true, allocationId, id: allocationId, amount: reqAmount, status: recStatus };
  }

  /**
   * تحرير وحذف حجز مخصص مالي (عند إلغاء عطاء أو أمر شراء)
   */
  async releaseAllocation({ entity_type, entityType, entity_id, entityId }, user = null) {
    const eType = (entity_type || entityType || '').toUpperCase();
    const eId = entity_id || entityId;
    if (!eType || !eId) throw new Error('نوع الكيان ومعرفه إلزاميان لتحرير المخصص.');

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(
          "UPDATE public.directorate_budget_allocations SET status = 'RELEASED', updated_at = NOW() WHERE UPPER(entity_type) = $1 AND entity_id = $2",
          [eType, String(eId)]
        );
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL release allocation failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      }
    }

    const allocations = this._getAllocationsCollection();
    allocations.forEach(a => {
      if ((String(a.entity_type || a.entityType).toUpperCase() === eType) && (String(a.entity_id || a.entityId) === String(eId))) {
        a.status = 'RELEASED';
      }
    });
    saveMemTable('directorate_budget_allocations');
    saveMemTable('budget_allocations');

    await this._recordAudit(user?.id, eId, 'BUDGET_ALLOCATION_RELEASED', null, { eType, eId });
    return { success: true, message: 'تم تحرير وإلغاء حجز المخصص المالي بنجاح.' };
  }

  /**
   * تحويل التزام مالي معلق إلى مصروف فعلي مسدد (Disbursement)
   */
  async disburseAllocation({ entity_type, entityType, entity_id, entityId }, user = null) {
    const eType = (entity_type || entityType || '').toUpperCase();
    const eId = entity_id || entityId;
    if (!eType || !eId) throw new Error('نوع الكيان ومعرفه إلزاميان للصرف.');

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(
          "UPDATE public.directorate_budget_allocations SET status = 'DISBURSED', updated_at = NOW() WHERE UPPER(entity_type) = $1 AND entity_id = $2",
          [eType, String(eId)]
        );
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL disburse allocation failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      }
    }

    const allocations = this._getAllocationsCollection();
    allocations.forEach(a => {
      if ((String(a.entity_type || a.entityType).toUpperCase() === eType) && (String(a.entity_id || a.entityId) === String(eId))) {
        a.status = 'DISBURSED';
      }
    });
    saveMemTable('directorate_budget_allocations');
    saveMemTable('budget_allocations');

    await this._recordAudit(user?.id, eId, 'BUDGET_ALLOCATION_DISBURSED', null, { eType, eId });
    return { success: true, message: 'تم تحويل المخصص إلى مصروف فعلي مسدد.' };
  }

  /**
   * تعديل مبلغ مخصص مالي قائم (مثلاً عند تعديل قيمة عطاء أو أمر شراء)
   */
  async updateAllocationAmount({ entity_type, entityType, entity_id, entityId, amount }, user = null) {
    const eType = (entity_type || entityType || '').toUpperCase();
    const eId = entity_id || entityId;
    const newAmount = this._roundCurrency(amount);
    if (!eType || !eId) throw new Error('نوع الكيان ومعرفه إلزاميان لتحديث المبلغ.');
    if (isNaN(newAmount) || newAmount <= 0) {
      throw new Error('قيمة مبلغ المخصص المالي يجب أن تكون قيمة رقمية موجبة أكبر من الصفر.');
    }

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query("UPDATE public.directorate_budget_allocations SET amount = $1, updated_at = NOW() WHERE UPPER(entity_type) = $2 AND entity_id = $3", [newAmount, eType, String(eId)]);
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL update allocation amount failed: ${e.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${e.message}`);
      }
    }

    const allocations = this._getAllocationsCollection();
    const item = allocations.find(a => (String(a.entity_type || a.entityType).toUpperCase() === eType) && (String(a.entity_id || a.entityId) === String(eId)));
    if (item) {
      item.amount = newAmount;
      saveMemTable('directorate_budget_allocations');
      saveMemTable('budget_allocations');
    }

    await this._recordAudit(user?.id, eId, 'BUDGET_ALLOCATION_UPDATED', null, { eType, eId, newAmount });
    return { success: true, message: 'تم تحديث مبلغ المخصص المالي بنجاح.' };
  }

  /**
   * استرجاع سجلات المخصصات والارتباطات المالية
   */
  async getAllocations(filters = {}) {
    const bId = filters.budget_line_id || filters.budgetLineId;
    const eId = filters.entity_id || filters.entityId;

    let list = [];
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = 'SELECT * FROM public.directorate_budget_allocations WHERE 1=1';
        const params = [];
        if (bId) {
          params.push(bId);
          sql += ` AND budget_line_id = $${params.length}`;
        }
        if (eId) {
          params.push(eId);
          sql += ` AND entity_id = $${params.length}`;
        }
        sql += ' ORDER BY created_at DESC';
        const res = await pool.query(sql, params);
        list = res.rows || [];
      } catch (e) {
        logError('BudgetEngine', `PostgreSQL getAllocations query failed: ${e.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${e.message}`);
      }
    } else {
      const allocations = this._getAllocationsCollection();
      list = allocations.filter(a => {
        if (bId && String(a.budget_line_id || a.budgetLineId) !== String(bId)) return false;
        if (eId && String(a.entity_id || a.entityId) !== String(eId)) return false;
        return true;
      });
    }
    return list;
  }

  /**
   * احتساب مقاييس الالتزام والصرف الفعلي لبند محدد
   */
  async calculateLineMetrics(budgetLineId, knownAllocatedAmount = null) {
    let allocs = [];
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const allocRes = await pool.query('SELECT * FROM public.directorate_budget_allocations WHERE budget_line_id = $1', [budgetLineId]);
        allocs = allocRes.rows || [];
      } catch (e) {
        logError('BudgetEngine', `calculateLineMetrics allocations query error: ${e.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${e.message}`);
      }
    } else {
      const allocations = this._getAllocationsCollection();
      allocs = allocations.filter(a => String(a.budget_line_id || a.budgetLineId) === String(budgetLineId));
    }

    let committed = 0;
    let spent = 0;

    allocs.forEach(a => {
      const amt = parseFloat(a.amount) || 0;
      const st = (a.status || '').toUpperCase();
      if (st === 'PAID' || st === 'DISBURSED') {
        spent += amt;
        committed += amt;
      } else if (st === 'COMMITTED' || st === 'ACTIVE') {
        committed += amt;
      }
    });

    let lineAllocated = 0;
    if (knownAllocatedAmount !== null && !isNaN(knownAllocatedAmount)) {
      lineAllocated = parseFloat(knownAllocatedAmount);
    } else if (isPostgresActive()) {
      try {
        const pool = getPool();
        const lineRes = await pool.query('SELECT allocated_amount, total_amount FROM public.directorate_budget_lines WHERE id = $1', [budgetLineId]);
        lineAllocated = parseFloat(lineRes?.rows[0]?.allocated_amount || lineRes?.rows[0]?.total_amount || 0);
      } catch (e) {
        logError('BudgetEngine', `calculateLineMetrics line query error: ${e.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${e.message}`);
      }
    } else {
      const lines = this._getLinesCollection();
      const line = lines.find(l => String(l.id) === String(budgetLineId));
      lineAllocated = parseFloat(line?.allocated_amount || line?.total_amount || 0);
    }

    const available_commitment = Math.max(0, this._roundCurrency(lineAllocated - committed));
    const remaining_amount = Math.max(0, this._roundCurrency(lineAllocated - spent));

    return {
      committed: this._roundCurrency(committed),
      spent: this._roundCurrency(spent),
      committed_amount: this._roundCurrency(committed),
      spent_amount: this._roundCurrency(spent),
      available_commitment,
      remaining_amount
    };
  }

  /**
   * استعلام الملخص المالي العام لموازنة المديرية
   */
  async getBudgetSummary(year = null) {
    const currentYear = (year || new Date().getFullYear()).toString();
    const lines = await this.getBudgetLines({ fiscalYear: currentYear });

    let totalAllocated = 0;
    let totalCommitted = 0;
    let totalSpent = 0;

    lines.forEach(l => {
      totalAllocated += parseFloat(l.allocated_amount || l.total_amount || 0);
      totalCommitted += parseFloat(l.committed_amount || 0);
      totalSpent += parseFloat(l.spent_amount || 0);
    });

    totalAllocated = this._roundCurrency(totalAllocated);
    totalCommitted = this._roundCurrency(totalCommitted);
    totalSpent = this._roundCurrency(totalSpent);

    const uncommittedBalance = Math.max(0, this._roundCurrency(totalAllocated - totalCommitted));
    const unspentBalance = Math.max(0, this._roundCurrency(totalAllocated - totalSpent));
    const commitmentRate = totalAllocated > 0 ? Math.min(100, Math.round((totalCommitted / totalAllocated) * 100)) : 0;
    const executionRate = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;

    return {
      year: currentYear,
      totalLines: lines.length,
      total_lines: lines.length,
      totalAllocated,
      total_allocated: totalAllocated,
      totalCommitted,
      total_committed: totalCommitted,
      totalSpent,
      total_spent: totalSpent,
      uncommittedBalance,
      uncommitted_balance: uncommittedBalance,
      unspentBalance,
      unspent_balance: unspentBalance,
      commitmentRate,
      commitment_rate: commitmentRate,
      executionRate,
      execution_rate: executionRate,
      lines
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalLines = 0;
    try {
      if (isPostgresActive()) {
        const pool = getPool();
        const res = await pool.query('SELECT COUNT(*) as count FROM public.directorate_budget_lines');
        totalLines = parseInt(res?.rows[0]?.count || 0, 10);
      } else {
        totalLines = this._getLinesCollection().length;
      }
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalBudgetLines: totalLines,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      logError('BudgetEngine', `HealthCheck failure: ${e.message}`);
      return {
        healthy: false,
        status: 'DEGRADED',
        engineId: this.engineId,
        error: e.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const budgetEngineService = new BudgetEngineService();
budgetEngineService.init();

module.exports = budgetEngineService;

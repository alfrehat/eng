/**
 * services/budgetEngineService.js
 * 🏛️ محرك الموازنة العامة لمديرية الأشغال والخدمات الهندسية (Directorate General Budget Engine)
 * بلدية كفرنجة الجديدة - الإصدار المؤسسي الموحد
 * 
 * المسؤوليات الهندسية:
 * 1. إدارة بنود وفصول موازنة المديرية السنوية ومصادر التمويل.
 * 2. حجز وتخصيص المخصصات المالية للمشاريع، العطاءات، وأوامر الشراء.
 * 3. رصد ومطابقة الالتزامات التعاقدية (Contracts & Commitments).
 * 4. رصد ومطابقة الصرف الفعلي التراكمي من المطالبات والمستخلصات والمشتريات.
 * 5. فحص سقف الموازنة المعتمدة ومنع التجاوز المالي (Budget Ceiling Enforcement).
 * 6. التحليلات والانحرافات المالية ونسب الإنجاز المالي.
 */

const {
  dbQuery,
  dbGet,
  dbRun,
  generateSequenceId,
  isPostgresActive,
  memDb,
  saveMemTable
} = require('../utils/database');

class BudgetEngineService {
  constructor() {
    this.name = 'BUDGET_ENGINE';
    this.version = '1.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.capabilities = [
      'budget_crud',
      'budget_allocation',
      'budget_ceiling_validation',
      'variance_analysis',
      'expenditure_tracking'
    ];
    this.initialized = false;
  }

  async init() {
    try {
      if (isPostgresActive()) {
        await dbRun(`
          CREATE TABLE IF NOT EXISTS directorate_budget_lines (
            id VARCHAR(50) PRIMARY KEY,
            year VARCHAR(10) NOT NULL,
            chapter_code VARCHAR(50),
            chapter_name VARCHAR(255) NOT NULL,
            line_code VARCHAR(50),
            line_name VARCHAR(255) NOT NULL,
            allocated_amount NUMERIC(15,2) DEFAULT 0.00,
            funding_source VARCHAR(100) DEFAULT 'موازنة البلدية الذاتية',
            department VARCHAR(100) DEFAULT 'مديرية الأشغال',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await dbRun(`
          CREATE TABLE IF NOT EXISTS directorate_budget_allocations (
            id VARCHAR(50) PRIMARY KEY,
            budget_line_id VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(50) NOT NULL,
            entity_name VARCHAR(255),
            amount NUMERIC(15,2) DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'COMMITTED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } else {
        if (!memDb.directorate_budget_lines) {
          memDb.directorate_budget_lines = [];
          saveMemTable('directorate_budget_lines');
        }
        if (!memDb.directorate_budget_allocations) {
          memDb.directorate_budget_allocations = [];
          saveMemTable('directorate_budget_allocations');
        }
      }
      this.initialized = true;
    } catch (e) {
      console.warn('[BudgetEngine] Init warning:', e.message);
      this.initialized = true;
    }
  }

  async healthCheck() {
    return {
      engine: this.name,
      status: this.initialized ? 'READY' : 'DEGRADED',
      capabilities: this.capabilities,
      timestamp: new Date().toISOString()
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. استعلام الملخص المالي العام للموازنة (Budget Summary & KPIs)
  // ══════════════════════════════════════════════════════════════════════
  async getBudgetSummary(year = null) {
    const currentYear = year || new Date().getFullYear().toString();
    const lines = await this.getBudgetLines({ year: currentYear });

    let totalAllocated = 0;
    lines.forEach(l => {
      totalAllocated += parseFloat(l.allocated_amount || 0);
    });

    // استخراج الالتزامات من العقود والعطاءات
    let totalCommitted = 0;
    let totalSpent = 0;

    lines.forEach(l => {
      totalCommitted += parseFloat(l.committed_amount || 0);
      totalSpent += parseFloat(l.spent_amount || 0);
    });

    const uncommittedBalance = Math.max(0, totalAllocated - totalCommitted);
    const unspentBalance = Math.max(0, totalAllocated - totalSpent);
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

  // ══════════════════════════════════════════════════════════════════════
  // 2. إدارة بنود وفصول الموازنة (Budget Lines CRUD)
  // ══════════════════════════════════════════════════════════════════════
  async getBudgetLines(filters = {}) {
    let lines = [];
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM directorate_budget_lines WHERE 1=1';
      const params = [];
      if (filters.year) {
        params.push(filters.year);
        sql += ` AND year = $${params.length}`;
      }
      if (filters.funding_source) {
        params.push(filters.funding_source);
        sql += ` AND funding_source = $${params.length}`;
      }
      if (filters.department) {
        params.push(filters.department);
        sql += ` AND department = $${params.length}`;
      }
      sql += ' ORDER BY chapter_code ASC, line_code ASC, id ASC';
      lines = (await dbQuery(sql, params)) || [];
    } else {
      lines = (memDb.directorate_budget_lines || []).filter(l => {
        if (filters.year && String(l.year) !== String(filters.year)) return false;
        if (filters.funding_source && l.funding_source !== filters.funding_source) return false;
        if (filters.department && l.department !== filters.department) return false;
        return true;
      });
    }

    // احتساب الالتزامات والصرف الفعلي لكل بند من الارتباطات
    for (const line of lines) {
      const metrics = await this.calculateLineMetrics(line.id);
      line.committed_amount = metrics.committed;
      line.spent_amount = metrics.spent;
      line.remaining_amount = Math.max(0, parseFloat(line.allocated_amount || 0) - metrics.spent);
      line.available_commitment = Math.max(0, parseFloat(line.allocated_amount || 0) - metrics.committed);
      line.spent_percentage = parseFloat(line.allocated_amount) > 0 ? Math.min(100, Math.round((metrics.spent / parseFloat(line.allocated_amount)) * 100)) : 0;
      line.commitment_percentage = parseFloat(line.allocated_amount) > 0 ? Math.min(100, Math.round((metrics.committed / parseFloat(line.allocated_amount)) * 100)) : 0;
    }

    return lines;
  }

  async getBudgetLineById(id) {
    let line = null;
    if (isPostgresActive()) {
      line = await dbGet('SELECT * FROM directorate_budget_lines WHERE id = $1', [id]);
    } else {
      line = (memDb.directorate_budget_lines || []).find(l => String(l.id) === String(id));
    }
    if (!line) return null;

    const metrics = await this.calculateLineMetrics(line.id);
    line.committed_amount = metrics.committed;
    line.spent_amount = metrics.spent;
    line.remaining_amount = Math.max(0, parseFloat(line.allocated_amount || 0) - metrics.spent);
    line.available_commitment = Math.max(0, parseFloat(line.allocated_amount || 0) - metrics.committed);

    return line;
  }

  async createBudgetLine(data) {
    if (!data.line_name || !data.allocated_amount) {
      throw new Error('اسم البند وقيمة المخصص المالي حقول إلزامية');
    }

    const id = data.id || ('BL-' + (data.year || data.fiscal_year || new Date().getFullYear()) + '-' + Date.now().toString().slice(-4));
    const year = (data.year || data.fiscal_year || new Date().getFullYear()).toString();
    const chapterCode = data.chapter_code || '211';
    const chapterName = data.chapter_name || 'نفقات المشاريع الرأسمالية';
    const lineCode = data.line_code || id;
    const lineName = data.line_name;
    const allocatedAmount = parseFloat(data.allocated_amount) || 0;
    const fundingSource = data.funding_source || 'موازنة البلدية الذاتية';
    const department = data.department || 'مديرية الأشغال والخدمات الهندسية';
    const notes = data.notes || '';
    const now = new Date().toISOString();

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO directorate_budget_lines (
          id, year, chapter_code, chapter_name, line_code, line_name,
          allocated_amount, funding_source, department, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [id, year, chapterCode, chapterName, lineCode, lineName, allocatedAmount, fundingSource, department, notes]);
    } else {
      if (!memDb.directorate_budget_lines) memDb.directorate_budget_lines = [];
      memDb.directorate_budget_lines.unshift({
        id, year, chapter_code: chapterCode, chapter_name: chapterName,
        line_code: lineCode, line_name: lineName, allocated_amount: allocatedAmount,
        funding_source: fundingSource, department, notes, created_at: now, updated_at: now
      });
      saveMemTable('directorate_budget_lines');
    }

    return await this.getBudgetLineById(id);
  }

  async updateBudgetLine(id, data) {
    const existing = await this.getBudgetLineById(id);
    if (!existing) throw new Error('بند الموازنة غير موجود');

    const year = data.year || existing.year;
    const chapterCode = data.chapter_code || existing.chapter_code;
    const chapterName = data.chapter_name || existing.chapter_name;
    const lineCode = data.line_code || existing.line_code;
    const lineName = data.line_name || existing.line_name;
    const allocatedAmount = data.allocated_amount !== undefined ? parseFloat(data.allocated_amount) : existing.allocated_amount;
    const fundingSource = data.funding_source || existing.funding_source;
    const department = data.department || existing.department;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const now = new Date().toISOString();

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE directorate_budget_lines SET
          year = $1, chapter_code = $2, chapter_name = $3, line_code = $4,
          line_name = $5, allocated_amount = $6, funding_source = $7,
          department = $8, notes = $9, updated_at = NOW()
        WHERE id = $10
      `, [year, chapterCode, chapterName, lineCode, lineName, allocatedAmount, fundingSource, department, notes, id]);
    } else {
      const idx = (memDb.directorate_budget_lines || []).findIndex(l => String(l.id) === String(id));
      if (idx !== -1) {
        memDb.directorate_budget_lines[idx] = {
          ...memDb.directorate_budget_lines[idx],
          year, chapter_code: chapterCode, chapter_name: chapterName,
          line_code: lineCode, line_name: lineName, allocated_amount: allocatedAmount,
          funding_source: fundingSource, department, notes, updated_at: now
        };
        saveMemTable('directorate_budget_lines');
      }
    }

    return await this.getBudgetLineById(id);
  }

  async deleteBudgetLine(id) {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM directorate_budget_allocations WHERE budget_line_id = $1', [id]);
      await dbRun('DELETE FROM directorate_budget_lines WHERE id = $1', [id]);
    } else {
      if (memDb.directorate_budget_allocations) {
        memDb.directorate_budget_allocations = memDb.directorate_budget_allocations.filter(a => String(a.budget_line_id) !== String(id));
        saveMemTable('directorate_budget_allocations');
      }
      if (memDb.directorate_budget_lines) {
        memDb.directorate_budget_lines = memDb.directorate_budget_lines.filter(l => String(l.id) !== String(id));
        saveMemTable('directorate_budget_lines');
      }
    }
    return { success: true, message: 'تم حذف بند الموازنة بنجاح' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. التخصيص والارتباط المالي (Allocations & Commitments)
  // ══════════════════════════════════════════════════════════════════════
  async createAllocation(data) {
    const { budget_line_id, entity_type, entity_id, entity_name, amount, status } = data;
    if (!budget_line_id || !entity_id || !amount) {
      throw new Error('معرف البند ومعرف الكيان والمبلغ حقول إلزامية');
    }

    // فحص سقف الموازنة المتاح قبل الحجز (Budget Ceiling Validation)
    const line = await this.getBudgetLineById(budget_line_id);
    if (!line) throw new Error('بند الموازنة المحدد غير موجود');

    const requestedAmount = parseFloat(amount) || 0;
    if (requestedAmount > line.available_commitment) {
      throw new Error(`المبلغ المطلوب (${requestedAmount.toLocaleString()} د.أ) يتجاوز الرصيد المتاح للارتباط في البند (${line.available_commitment.toLocaleString()} د.أ)`);
    }

    const id = 'ALLOC-' + Date.now();
    const now = new Date().toISOString();

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO directorate_budget_allocations (
          id, budget_line_id, entity_type, entity_id, entity_name, amount, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [id, budget_line_id, entity_type || 'PROJECT', entity_id, entity_name || '', requestedAmount, status || 'COMMITTED']);
    } else {
      if (!memDb.directorate_budget_allocations) memDb.directorate_budget_allocations = [];
      memDb.directorate_budget_allocations.push({
        id, budget_line_id, entity_type: entity_type || 'PROJECT', entity_id,
        entity_name: entity_name || '', amount: requestedAmount, status: status || 'COMMITTED', created_at: now
      });
      saveMemTable('directorate_budget_allocations');
    }

    return { success: true, id, message: 'تم حجز وتخصيص المبلغ من موازنة البند بنجاح' };
  }

  async getAllocations(filters = {}) {
    let list = [];
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM directorate_budget_allocations WHERE 1=1';
      const params = [];
      if (filters.budget_line_id) {
        params.push(filters.budget_line_id);
        sql += ` AND budget_line_id = $${params.length}`;
      }
      if (filters.entity_id) {
        params.push(filters.entity_id);
        sql += ` AND entity_id = $${params.length}`;
      }
      sql += ' ORDER BY created_at DESC';
      list = (await dbQuery(sql, params)) || [];
    } else {
      list = (memDb.directorate_budget_allocations || []).filter(a => {
        if (filters.budget_line_id && a.budget_line_id !== filters.budget_line_id) return false;
        if (filters.entity_id && a.entity_id !== filters.entity_id) return false;
        return true;
      });
    }
    return list;
  }

  async calculateLineMetrics(budgetLineId) {
    let allocs = [];
    if (isPostgresActive()) {
      allocs = (await dbQuery('SELECT * FROM directorate_budget_allocations WHERE budget_line_id = $1', [budgetLineId])) || [];
    } else {
      allocs = (memDb.directorate_budget_allocations || []).filter(a => String(a.budget_line_id) === String(budgetLineId));
    }

    let committed = 0;
    let spent = 0;

    allocs.forEach(a => {
      const amt = parseFloat(a.amount) || 0;
      if (a.status === 'PAID') {
        spent += amt;
        committed += amt;
      } else if (a.status === 'COMMITTED') {
        committed += amt;
      }
    });

    let lineAllocated = 0;
    if (isPostgresActive()) {
      const line = await dbGet('SELECT allocated_amount FROM directorate_budget_lines WHERE id = $1', [budgetLineId]);
      lineAllocated = parseFloat(line?.allocated_amount || 0);
    } else {
      const line = (memDb.directorate_budget_lines || []).find(l => String(l.id) === String(budgetLineId));
      lineAllocated = parseFloat(line?.allocated_amount || 0);
    }

    const available_commitment = Math.max(0, lineAllocated - committed);
    const remaining_amount = Math.max(0, lineAllocated - spent);

    return {
      committed,
      spent,
      committed_amount: committed,
      spent_amount: spent,
      available_commitment,
      remaining_amount
    };
  }
}

const budgetEngineService = new BudgetEngineService();
budgetEngineService.init();

module.exports = budgetEngineService;

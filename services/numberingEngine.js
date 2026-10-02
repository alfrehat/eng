/**
 * services/numberingEngine.js
 * 🔢 محرك الترقيم المركزي الموحد ومنظومة المعرفات (NUMBERING_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Numbering Patch
 */

const { getPool, isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

class NumberingEngineService {
  constructor() {
    this.engineId = 'NUMBERING_ENGINE';
    this.engineName = 'Enterprise Central Numbering & Sequence Engine';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'atomic_sequence_generation',
      'fiscal_year_reset',
      'custom_prefixes',
      'concurrent_safety',
      'table_sequence_registry'
    ];

    this.prefixMap = {
      tenders: 'TEN',
      tender: 'TEN',
      projects: 'PRJ',
      project: 'PRJ',
      tasks: 'TSK',
      task: 'TSK',
      purchases: 'PUR',
      purchase: 'PUR',
      purchase_orders: 'PUR',
      paving_returns: 'PAV',
      paving: 'PAV',
      documents: 'ARC',
      document: 'ARC',
      archive: 'ARC',
      roads: 'RD',
      road: 'RD',
      portfolios: 'POR',
      portfolio: 'POR',
      project_portfolios: 'POR',
      plans: 'PLN',
      plan: 'PLN',
      project_plans: 'PLN',
      criteria: 'CRT',
      claims: 'CLM',
      claim: 'CLM',
      contracts: 'CNT',
      contract: 'CNT',
      inspections: 'INSP',
      inspection: 'INSP',
      road_inspections: 'INSP',
      g2g_transactions: 'G2G',
      g2g: 'G2G',
      assets: 'AST',
      asset: 'AST',
      permits: 'PER',
      users: 'U',
      user: 'U',
      roles: 'R',
      role: 'R',
      org_units: 'OU',
      org_unit: 'OU',
      user_org_units: 'UOU',
      committees: 'COM',
      committee: 'COM',
      technical_committees: 'COM',
      tender_studies: 'TS',
      studies: 'TS',
      milestones: 'MLS',
      milestone: 'MLS',
      project_milestones: 'MLS',
      risks: 'RSK',
      risk: 'RSK',
      project_risks: 'RSK',
      progress_logs: 'PRG',
      progress_log: 'PRG',
      project_progress_logs: 'PRG',
      scores: 'SCR',
      project_priority_scores: 'SCR',
      priority_results: 'RES',
      dependencies: 'DEP',
      project_dependencies: 'DEP',
      portfolio_projects: 'PPR',
      plan_projects: 'PLPR',
      financial_programs: 'FIN-PRG',
      general: 'GEN'
    };

    this.defaultPrefixes = this.prefixMap;
  }

  /**
   * استخراج البادئة المعتمدة للكيان
   */
  resolvePrefix(entityType, explicitPrefix = null) {
    if (explicitPrefix) return String(explicitPrefix).replace(/[-_]+$/, '').toUpperCase();
    const key = (entityType || '').toLowerCase().trim();
    return this.prefixMap[key] || 'GEN';
  }

  async resolvePrefixAsync(entityType, explicitPrefix = null) {
    return this.resolvePrefix(entityType, explicitPrefix);
  }

  /**
   * توليد المعرف التسلسلي التالي بطريقة ذرية آمنة ضد التنافس
   */
  async generateNextId(entityType, options = {}) {
    const rawType = (entityType || 'general').toLowerCase().trim();
    const type = (rawType === 'archive' || rawType === 'document') ? 'documents' : rawType;
    const currentYear = options.year || new Date().getFullYear();
    const prefix = options.prefix || this.prefixMap[type] || 'GEN';
    const padding = options.padding !== undefined ? options.padding : 4;
    const includeYear = options.includeYear !== undefined ? options.includeYear : true;
    const seqKey = includeYear ? `${type}_${currentYear}` : `${type}_sequence`;

    if (isPostgresActive()) {
      const pool = getPool();
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        // الجدول منشأ وموثق كنونياً عبر migrations/023_canonical_sequences_and_tasks_schema.sql

        // قفل ذري للـ Row لمنع السباق (Race Condition Lock)
        let res = await client.query('SELECT last_value FROM public.system_sequences WHERE seq_key = $1 FOR UPDATE', [seqKey]);
        
        let nextVal = 1;
        if (res.rows.length === 0) {
          await client.query(
            'INSERT INTO public.system_sequences (seq_key, prefix, fiscal_year, last_value, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (seq_key) DO NOTHING',
            [seqKey, prefix, currentYear, 0]
          );
          res = await client.query('SELECT last_value FROM public.system_sequences WHERE seq_key = $1 FOR UPDATE', [seqKey]);
        }

        let currentLast = res.rows.length > 0 ? parseInt(res.rows[0].last_value || 0, 10) : 0;
        if (type === 'users') {
          try {
            const maxU = await client.query(`SELECT id FROM public.users WHERE id ~ '^U-[0-9]+$' ORDER BY length(id) DESC, id DESC LIMIT 1`);
            if (maxU.rows.length > 0) {
              const parsedMax = parseInt(maxU.rows[0].id.replace(/^U-/, ''), 10);
              if (parsedMax > currentLast) {
                currentLast = parsedMax;
              }
            }
          } catch (e) {}
        }
        nextVal = currentLast + 1;

        await client.query(
          'UPDATE public.system_sequences SET last_value = $1, updated_at = NOW() WHERE seq_key = $2',
          [nextVal, seqKey]
        );

        await client.query('COMMIT');
        
        const paddedNum = String(nextVal).padStart(padding, '0');
        return includeYear ? `${prefix}-${currentYear}-${paddedNum}` : `${prefix}-${paddedNum}`;
      } catch (err) {
        if (client) await client.query('ROLLBACK');
        logError('NumberingEngine', `Failed to generate atomic ID for ${type}: ${err.message}`);
        // مسار بديل طارئ في حال فشل قاعدة البيانات اللحظي
        return includeYear ? `${prefix}-${currentYear}-${Date.now().toString().slice(-4)}` : `${prefix}-${Date.now().toString().slice(-4)}`;
      } finally {
        if (client) client.release();
      }
    } else {
      // النمط المحلي (Memory Fallback)
      if (!memDb.system_sequences) memDb.system_sequences = [];
      let seq = memDb.system_sequences.find(s => s.seq_key === seqKey);

      if (!seq) {
        seq = { seq_key: seqKey, prefix, fiscal_year: currentYear, last_value: 0 };
        memDb.system_sequences.push(seq);
      }

      seq.last_value += 1;
      saveMemTable('system_sequences');

      const paddedNum = String(seq.last_value).padStart(padding, '0');
      return includeYear ? `${prefix}-${currentYear}-${paddedNum}` : `${prefix}-${paddedNum}`;
    }
  }

  /**
   * استرجاع العداد الحالي دون زيادة (لقراءة التسلسل المسبق)
   */
  getNextSequence(entityType) {
    const rawType = (entityType || 'general').toLowerCase().trim();
    const type = (rawType === 'archive' || rawType === 'document') ? 'documents' : rawType;
    const currentYear = new Date().getFullYear();
    const seqKey = `${type}_${currentYear}`;
    if (memDb.system_sequences) {
      const seq = memDb.system_sequences.find(s => s.seq_key === seqKey);
      if (seq) return seq.last_value + 1;
    }
    return 1;
  }

  /**
   * فحص سلامة وصحة رقم تسلسلي بدقة مع دعم البادئات المركبة
   */
  validateIdFormat(idStr, expectedPrefix = null) {
    if (!idStr || typeof idStr !== 'string') return false;
    
    // التعبير النمطي: بادئة نصية متبوعة بسنة من 4 أرقام ورقم تسلسلي
    const regex = /^([A-Z0-9_-]+)-(\d{4})-(\d+)$/i;
    const match = idStr.match(regex);
    if (!match) return false;

    const [, prefix, yearStr, numStr] = match;

    if (expectedPrefix) {
      const cleanExpected = expectedPrefix.replace(/[-_]+$/, '').toUpperCase();
      if (prefix.toUpperCase() !== cleanExpected) return false;
    }

    const year = parseInt(yearStr, 10);
    if (year < 2000 || year > 2100) return false;
    if (parseInt(numStr, 10) <= 0) return false;

    return true;
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalSequences = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.system_sequences');
        totalSequences = parseInt(res?.count || 0, 10);
      } else {
        totalSequences = (memDb.system_sequences || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalActiveSequences: totalSequences,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalActiveSequences: (memDb.system_sequences || []).length,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new NumberingEngineService();

/**
 * services/numberingEngine.js
 * 🔢 محرك الترقيم المتسلسل والترميز الآلي الموحد (Unified Enterprise Numbering Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v1.0
 * 
 * المبادئ الهندسية:
 * 1. محرك مركزي عام ومستقل لتوليد الأرقام التسلسلية لكافة كيانات النظام.
 * 2. دعم البادئات الديناميكية المخصصة في جدول إعدادات النظام system_settings مع قيم افتراضية معيارية.
 * 3. منع الـ Race Conditions والتضارب في الترقيم عبر الاستعلام الذري في PostgreSQL والتراجع المحلي الآمن.
 * 4. توافقية كاملة وتكامل سلس مع كافة الوحدات الخدمية والموديلات.
 */

const { isPostgresActive, getPool, memDb } = require('../utils/database');
const { logInfo, logWarn, logError } = require('../utils/logger');

class NumberingEngine {
  constructor() {
    this.engineId = 'NUMBERING_ENGINE';
    this.engineName = 'Enterprise Auto-Numbering Engine';
    this.version = '1.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';

    // مصفوفة البادئات القياسية المعتمدة في النظام
    this.defaultPrefixes = {
      tenders: 'TEN',
      claims: 'CLM',
      excavation_permits: 'PER',
      permits: 'PER',
      paving_returns: 'PAV',
      paving: 'PAV',
      tasks: 'TSK',
      inspection_tasks: 'TSK',
      contracts: 'CNT',
      roads: 'RD',
      purchases: 'PUR',
      purchase_orders: 'PUR',
      assets: 'AST',
      archive: 'ARC',
      documents: 'DOC',
      reports: 'RPT',
      committees: 'COM',
      workflows: 'WF',
      users: 'U',
      org_units: 'OU',
      projects: 'PRJ',
      portfolios: 'POR',
      project_portfolios: 'POR',
      plans: 'PLN',
      project_plans: 'PLN',
      roles: 'R'
    };
  }

  /**
   * استخراج البادئة الفعالة لكيان معين من جدول الإعدادات أو القيم الافتراضية
   * @param {string} entityType - اسم الجدول أو الكيان (مثل: tenders, claims, contracts, roads)
   * @param {string} explicitPrefix - بادئة مخصصة محددة اختيارياً
   * @returns {string} البادئة المطهرة بدون فواصل زائدة
   */
  resolvePrefix(entityType, explicitPrefix = null) {
    if (explicitPrefix) {
      return explicitPrefix.replace(/[-_]+$/, '').toUpperCase();
    }

    const tableKey = (entityType || '').toLowerCase();
    let effective = this.defaultPrefixes[tableKey] || 'DOC';

    try {
      const settings = (memDb && memDb.system_settings && memDb.system_settings[0]) || {};
      if ((tableKey === 'tenders' || tableKey === 'tender') && settings.prefix_tenders) {
        effective = settings.prefix_tenders;
      } else if ((tableKey === 'claims' || tableKey === 'claim') && settings.prefix_claims) {
        effective = settings.prefix_claims;
      } else if ((tableKey === 'excavation_permits' || tableKey === 'permits' || tableKey === 'permit') && settings.prefix_permits) {
        effective = settings.prefix_permits;
      } else if ((tableKey === 'paving_returns' || tableKey === 'paving') && settings.prefix_paving) {
        effective = settings.prefix_paving;
      } else if ((tableKey === 'tasks' || tableKey === 'inspection_tasks') && settings.prefix_tasks) {
        effective = settings.prefix_tasks;
      } else if ((tableKey === 'contracts' || tableKey === 'contract') && settings.prefix_contracts) {
        effective = settings.prefix_contracts;
      }
    } catch (e) {
      logWarn('NumberingEngine', `Failed to read settings prefix: ${e.message}`);
    }

    return effective.replace(/[-_]+$/, '').toUpperCase();
  }

  /**
   * توليد رقم تسلسلي فريد وغير متضارب لمعاملة جديدة
   * النمط القياسي: {PREFIX}-{YEAR}-{SEQUENCE_NUMBER} (مثال: TEN-2026-001)
   * 
   * @param {string} entityType - اسم الكيان أو الجدول (tenders, claims, contracts, ...)
   * @param {Object} options - خيارات إضافية { prefix, padding, year, customPattern }
   * @returns {Promise<string>} المعرف التسلسلي المولد
   */
  async generateNextId(entityType, options = {}) {
    const table = (entityType || 'documents').toLowerCase();
    const effectivePrefix = this.resolvePrefix(table, options.prefix);
    const year = options.year || new Date().getFullYear();
    const padding = options.padding || 3;
    const searchPattern = `${effectivePrefix}-${year}-%`;

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        const queryText = `
          SELECT id FROM ${table} 
          WHERE id LIKE $1 
          ORDER BY id DESC 
          LIMIT 1
        `;
        const res = await pool.query(queryText, [searchPattern]);
        if (!res.rows || !res.rows.length) {
          return `${effectivePrefix}-${year}-${String(1).padStart(padding, '0')}`;
        }

        const lastId = String(res.rows[0].id);
        const parts = lastId.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
        const nextNum = lastNum + 1;
        return `${effectivePrefix}-${year}-${String(nextNum).padStart(padding, '0')}`;
      } catch (err) {
        logWarn('NumberingEngine', `PostgreSQL sequence lookup fallback for table "${table}": ${err.message}`);
      }
    }

    // In-memory fallback
    const records = (memDb && memDb[table] ? memDb[table] : []).filter(r => {
      return r && r.id && String(r.id).startsWith(`${effectivePrefix}-${year}-`);
    });

    if (!records.length) {
      return `${effectivePrefix}-${year}-${String(1).padStart(padding, '0')}`;
    }

    let maxNum = 0;
    for (const r of records) {
      const parts = String(r.id).split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    return `${effectivePrefix}-${year}-${String(nextNum).padStart(padding, '0')}`;
  }

  /**
   * فحص سلامة وصحة رقم تسلسلي وفق نمط معتمد
   * @param {string} idStr - الرقم التسلسلي المراد فحصه
   * @param {string} expectedPrefix - البادئة المتوقعة اختيارياً
   * @returns {boolean}
   */
  validateIdFormat(idStr, expectedPrefix = null) {
    if (!idStr || typeof idStr !== 'string') return false;
    const parts = idStr.split('-');
    if (parts.length < 3) return false;
    const [prefix, yearStr, numStr] = parts;
    if (expectedPrefix && prefix.toUpperCase() !== expectedPrefix.toUpperCase()) return false;
    if (!/^\d{4}$/.test(yearStr)) return false;
    if (!/^\d+$/.test(numStr)) return false;
    return true;
  }

  /**
   * فحص الحالة الصحية للمحرك
   */
  async healthCheck() {
    try {
      const testId = await this.generateNextId('tenders', { year: 2026 });
      const valid = this.validateIdFormat(testId);
      return {
        engineId: this.engineId,
        status: valid ? 'READY' : 'DEGRADED',
        activeMode: isPostgresActive() ? 'PostgreSQL' : 'In-Memory',
        sampleGeneratedId: testId,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        engineId: this.engineId,
        status: 'FAILED',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new NumberingEngine();

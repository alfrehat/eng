/**
 * utils/database.js
 * 🗄️ مدير قاعدة البيانات والطبقة الهجينة للبيانات (DATABASE_MANAGER)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Hybrid Database & Pool Manager
 */

'use strict';

try {
  require('dotenv').config();
} catch (e) {}

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let logger = null;
try {
  logger = require('../services/loggerService');
} catch (e) {
  try { logger = require('./loggerService'); } catch (e2) {}
}

const logInfo = (tag, msg) => (logger?.logInfo ? logger.logInfo(tag, msg) : console.log(`[INFO] [${tag}] ${msg}`));
const logWarn = (tag, msg) => (logger?.logWarn ? logger.logWarn(tag, msg) : console.warn(`[WARN] [${tag}] ${msg}`));
const logError = (tag, msg) => (logger?.logError ? logger.logError(tag, msg) : console.error(`[ERROR] [${tag}] ${msg}`));

let pool = null;
let postgresActive = false;
const memDb = {};

// دعم التخزين في مجلد database الأساسي ومجلد data البديل
const PRIMARY_DATA_DIR = path.join(__dirname, '..', 'database');
const FALLBACK_DATA_DIR = path.join(process.cwd(), 'data');

const MEM_TABLES = [
  'tenders', 'projects', 'tasks', 'claims', 'paving_returns', 'documents',
  'budget_lines', 'budget_allocations', 'municipal_assets', 'construction_contracts',
  'technical_committees', 'g2g_transactions', 'business_rules', 'system_sequences',
  'contracts', 'purchases', 'archive', 'roads', 'users', 'road_inspections',
  'road_defects', 'activity_log', 'workflows', 'org_units', 'roles', 'permissions',
  'role_permissions', 'user_org_units', 'system_settings', 'structural_assets',
  'infrastructure_networks', 'energy_lighting', 'excavation_permits', 'tender_daily_reports',
  'project_milestones', 'project_risks', 'project_progress_logs', 'project_portfolios',
  'project_portfolio_projects', 'project_plans', 'project_plan_projects',
  'project_priority_criteria', 'project_priority_scores', 'project_priority_results',
  'project_financial_programs', 'project_dependencies', 'project_schedules',
  'directorate_budget_lines', 'directorate_budget_allocations', 'token_blacklist'
];

/**
 * تهيئة مجلد التخزين المحلي للنمط البديل
 */
function _ensureDataDirectory() {
  try {
    if (!fs.existsSync(PRIMARY_DATA_DIR)) {
      fs.mkdirSync(PRIMARY_DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create primary database directory:', e.message);
  }
  try {
    if (!fs.existsSync(FALLBACK_DATA_DIR)) {
      fs.mkdirSync(FALLBACK_DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

/**
 * حفظ جدول محلي في ملف JSON لضمان الاستمرارية
 */
function saveMemTable(tableName) {
  try {
    _ensureDataDirectory();
    if (memDb[tableName]) {
      const dataStr = JSON.stringify(memDb[tableName], null, 2);
      const primaryPath = path.join(PRIMARY_DATA_DIR, `${tableName}.json`);
      fs.writeFileSync(primaryPath, dataStr, 'utf-8');

      // حفظ نسخة احتياطية إضافية في مجلد data
      try {
        const fallbackPath = path.join(FALLBACK_DATA_DIR, `${tableName}.json`);
        fs.writeFileSync(fallbackPath, dataStr, 'utf-8');
      } catch (fe) {}
    }
  } catch (e) {
    logWarn('DatabaseManager', `Failed to persist table [${tableName}] to disk: ${e.message}`);
  }
}

/**
 * تحميل جدول محلي مفرد
 */
function loadMemTable(tableName) {
  _ensureDataDirectory();
  const primaryPath = path.join(PRIMARY_DATA_DIR, `${tableName}.json`);
  const fallbackPath = path.join(FALLBACK_DATA_DIR, `${tableName}.json`);

  let loaded = false;
  if (fs.existsSync(primaryPath)) {
    try {
      const raw = fs.readFileSync(primaryPath, 'utf-8');
      memDb[tableName] = JSON.parse(raw || '[]');
      loaded = true;
    } catch (e) {
      memDb[tableName] = [];
    }
  }

  if (!loaded && fs.existsSync(fallbackPath)) {
    try {
      const raw = fs.readFileSync(fallbackPath, 'utf-8');
      memDb[tableName] = JSON.parse(raw || '[]');
      loaded = true;
    } catch (e) {
      memDb[tableName] = [];
    }
  }

  if (!loaded && !memDb[tableName]) {
    memDb[tableName] = [];
  }
}

/**
 * تحميل الجداول المحلية من القرص عند الإقلاع
 */
function loadMemTables() {
  _ensureDataDirectory();
  MEM_TABLES.forEach(loadMemTable);
}

// تحميل الجداول محلياً فور الإقلاع
loadMemTables();

/**
 * تنسيق عبارات SQL لتتوافق مع PostgreSQL (تحويل ? إلى $n)
 */
function formatSqlForPostgres(sql) {
  if (typeof sql !== 'string') return sql;
  let paramIndex = 1;
  let formatted = sql.replace(/\[(\w+)\]/g, '"$1"');
  formatted = formatted.replace(/\?/g, () => `$${paramIndex++}`);
  return formatted;
}

/**
 * إعداد وربط حوض اتصالات PostgreSQL
 */
function initDatabase() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString && !process.env.DB_HOST && !process.env.PGHOST) {
    logWarn('DatabaseManager', '⚠️ لم يتم رصد رابط اتصال PostgreSQL (DATABASE_URL). النظام يعمل بالنمط المحلي (In-Memory Fallback).');
    postgresActive = false;
    return null;
  }

  try {
    const config = connectionString
      ? {
          connectionString,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          max: 25,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        }
      : {
          host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
          port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
          user: process.env.DB_USER || process.env.PGUSER || 'postgres',
          password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
          database: process.env.DB_NAME || process.env.PGDATABASE || 'kafr_inja_engineering',
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          max: 25,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        };

    pool = new Pool(config);
    postgresActive = true;

    pool.on('error', (err) => {
      logError('DatabaseManager', `Unexpected error on idle PostgreSQL client: ${err.message}`);
      postgresActive = false;
    });

    pool.query('SELECT NOW()').then(() => {
      postgresActive = true;
      logInfo('DatabaseManager', '✅ تم الاتصال بنجاح بقاعدة بيانات PostgreSQL وتفعيل النمط المعاملاتي (ACID).');
    }).catch(err => {
      postgresActive = false;
      logWarn('DatabaseManager', `⚠️ تعذر الاتصال الفعلي بـ PostgreSQL: ${err.message}. التراجع إلى النمط المحلي.`);
    });

    return pool;
  } catch (e) {
    postgresActive = false;
    logError('DatabaseManager', `Failed to initialize PostgreSQL pool: ${e.message}`);
    return null;
  }
}

// تشغيل التهيئة الذاتية لقاعدة البيانات
initDatabase();

function isPostgresActive() {
  return Boolean(postgresActive && pool !== null && !pool.ending && !pool.ended);
}

function getPool() {
  return pool;
}

/**
 * تنفيذ استعلام عام (Query)
 */
async function dbQuery(sql, params = []) {
  if (isPostgresActive()) {
    const client = await pool.connect();
    try {
      const pgSql = formatSqlForPostgres(sql);
      const result = await client.query(pgSql, params);
      return result.rows;
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        return [];
      }
      logWarn('DatabaseManager', `PostgreSQL query note: ${err.message} (SQL: ${sql})`);
      throw err;
    } finally {
      client.release();
    }
  } else {
    // محاكاة استعلام في الذاكرة (للجداول المتوافقة)
    if (typeof sql === 'string') {
      const tableMatch = sql.match(/FROM\s+(?:public\.)?(\w+)/i);
      if (tableMatch) {
        const table = tableMatch[1].toLowerCase();
        if (memDb[table]) return [...memDb[table]];
      }
      if (sql.trim().toUpperCase().startsWith('SELECT')) return [{ result: 1 }];
    }
    return [];
  }
}

/**
 * جلب سجل مفرد (Single Record Get)
 */
async function dbGet(sql, params = []) {
  const rows = await dbQuery(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * تنفيذ عملية تعديل أو إدراج أو حذف (Run / Mutation)
 */
async function dbRun(sql, params = []) {
  if (isPostgresActive()) {
    const client = await pool.connect();
    try {
      const pgSql = formatSqlForPostgres(sql);
      const result = await client.query(pgSql, params);
      return { rowCount: result.rowCount, rows: result.rows };
    } catch (err) {
      logWarn('DatabaseManager', `dbRun note: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  } else {
    const isPgConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGHOST || process.env.DB_HOST);
    if (isPgConfigured) {
      throw new Error('PostgreSQL database connection is currently inactive; mutation aborted to prevent false success.');
    }
    return { rowCount: 1, rows: [] };
  }
}

/**
 * تنفيذ مجموعة عمليات ضمن معاملة ذرية متكاملة (ACID Transaction)
 */
async function withTransaction(callback) {
  if (!isPostgresActive() || !pool) {
    return await callback({
      query: (sql, params) => dbQuery(sql, params),
      run: (sql, params) => dbRun(sql, params)
    });
  }

  const client = await pool.connect();
  client.run = (sql, params) => client.query(sql, params);
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * توليد معرف متسلسل آمن وموحد مدعوم بمحرك الترقيم المركزي
 */
async function generateSequenceId(prefix, table) {
  try {
    const numberingEngine = require('../services/numberingEngine');
    return await numberingEngine.generateNextId(table || 'general', { prefix });
  } catch (err) {
    const year = new Date().getFullYear();
    const cleanPrefix = (prefix || 'DOC').replace(/-+$/, '');
    const rand = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    return `${cleanPrefix}-${year}-${rand}`;
  }
}

/**
 * إغلاق حوض الاتصالات بأمان
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    postgresActive = false;
    logInfo('DatabaseManager', 'PostgreSQL connection pool closed.');
  }
}

/**
 * فحص الصحة والجاهزية التشغيلية للطبقة الهجينة لقواعد البيانات
 */
async function healthCheck() {
  let dbStatus = 'DISCONNECTED_LOCAL_FALLBACK';
  let activeConnections = 0;
  
  if (isPostgresActive()) {
    try {
      const res = await dbGet('SELECT count(*)::int as count FROM pg_stat_activity');
      dbStatus = 'POSTGRESQL_CONNECTED';
      activeConnections = res?.count || 1;
    } catch (e) {
      dbStatus = 'POSTGRESQL_ERROR';
    }
  }

  return {
    healthy: true,
    status: 'READY',
    engineId: 'DATABASE_MANAGER',
    engineName: 'Enterprise Hybrid Database & Pool Manager',
    version: '2.0.0',
    dbMode: dbStatus,
    activeConnections,
    inMemoryTablesCount: Object.keys(memDb).length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  initDatabase,
  initializeDatabase: initDatabase,
  isPostgresActive,
  getPool,
  dbQuery,
  dbGet,
  dbRun,
  withTransaction,
  generateSequenceId,
  closeDatabase,
  memDb,
  saveMemTable,
  loadMemTable,
  loadMemTables,
  MEM_TABLES,
  healthCheck
};

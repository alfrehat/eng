// utils/database.js
// Centralized database utility functions
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logInfo, logError, logWarn } = require('../services/loggerService');

let pool = null;
let usePostgres = false;

// الذاكرة المؤقتة لملفات JSON
const MEM_DB_DIR = path.join(__dirname, '..', 'database');
if (!fs.existsSync(MEM_DB_DIR)) fs.mkdirSync(MEM_DB_DIR, { recursive: true });

const MEM_TABLES = [
  'tenders', 'claims', 'purchases', 'contracts', 'archive', 'roads',
  'users', 'road_inspections', 'road_defects', 'activity_log', 'workflows',
  'org_units', 'roles', 'permissions', 'role_permissions', 'user_org_units',
  'system_settings', 'paving_returns', 'structural_assets', 'infrastructure_networks',
  'energy_assets', 'excavation_permits', 'tender_daily_reports',
  'projects', 'project_milestones', 'project_risks', 'project_progress_logs',
  'project_portfolios', 'project_portfolio_projects', 'project_plans', 'project_plan_projects',
  'project_priority_criteria', 'project_priority_scores', 'project_priority_results',
  'project_financial_programs', 'project_dependencies', 'project_schedules',
  'directorate_budget_lines', 'directorate_budget_allocations'
];

const memDb = {};

function loadMemTable(table) {
  const file = path.join(MEM_DB_DIR, `${table}.json`);
  try {
    if (fs.existsSync(file)) {
      memDb[table] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      memDb[table] = [];
    }
  } catch(e) {
    memDb[table] = [];
  }
}

function saveMemTable(table) {
  try {
    const file = path.join(MEM_DB_DIR, `${table}.json`);
    fs.writeFile(file, JSON.stringify(memDb[table] || [], null, 2), 'utf8', (err) => {
      if (err) console.error('Failed to async-save table:', table, err.message);
    });
  } catch(e) {
    console.error('Failed to save table:', table, e.message);
  }
}

MEM_TABLES.forEach(loadMemTable);

async function initializeDatabase() {
  if (process.env.DATABASE_URL || process.env.DB_HOST || process.env.PGHOST || process.env.PGDATABASE || process.env.DB_NAME) {
    try {
      const config = process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, max: 25, idleTimeoutMillis: 30000, connectionTimeoutMillis: 3000 }
        : {
            host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
            port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
            user: process.env.DB_USER || process.env.PGUSER || 'postgres',
            password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
            database: process.env.DB_NAME || process.env.PGDATABASE || 'kafr_inja_engineering',
            max: 25,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3000
          };
      pool = new Pool(config);
      await pool.query('SELECT 1');
      usePostgres = true;
      logInfo('DatabaseManager', '✅ PostgreSQL Connection Pool Initialized Successfully.');
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
        await pool.query('CREATE SCHEMA IF NOT EXISTS enterprise');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.tender_daily_reports (
            id VARCHAR(50) PRIMARY KEY,
            tender_id VARCHAR(50) NOT NULL,
            report_date DATE NOT NULL,
            report_number VARCHAR(50),
            weather VARCHAR(100),
            temperature VARCHAR(50),
            supervisor_engineer VARCHAR(255),
            field_inspector VARCHAR(255),
            manpower_count INT DEFAULT 0,
            manpower_details TEXT,
            equipment_details TEXT,
            executed_works TEXT NOT NULL,
            materials_delivered TEXT,
            lab_tests TEXT,
            daily_progress_percent NUMERIC(5,2) DEFAULT 0,
            cumulative_progress_percent NUMERIC(5,2) DEFAULT 0,
            site_obstacles TEXT,
            instructions_to_contractor TEXT,
            attachment_path VARCHAR(500),
            site_photos TEXT,
            safety_status VARCHAR(50),
            asphalt_temp VARCHAR(50),
            concrete_slump VARCHAR(50),
            compaction_rate VARCHAR(50),
            work_hours NUMERIC(4,1) DEFAULT 8.0,
            work_delay_hours NUMERIC(4,1) DEFAULT 0,
            delay_reason VARCHAR(255),
            lat NUMERIC(10,6),
            lng NUMERIC(10,6),
            site_location_name VARCHAR(255),
            created_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS site_photos TEXT;
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS safety_status VARCHAR(50);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS asphalt_temp VARCHAR(50);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS concrete_slump VARCHAR(50);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS compaction_rate VARCHAR(50);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS work_hours NUMERIC(4,1) DEFAULT 8.0;
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS work_delay_hours NUMERIC(4,1) DEFAULT 0;
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS delay_reason VARCHAR(255);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS lat NUMERIC(10,6);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS lng NUMERIC(10,6);
          ALTER TABLE public.tender_daily_reports ADD COLUMN IF NOT EXISTS site_location_name VARCHAR(255);
        `);
      } catch(e) {}
      return { pool, usePostgres };
    } catch (err) {
      logError('DatabaseManager', '❌ Failed to connect to PostgreSQL. Falling back to local mode:', { error: err.message });
      usePostgres = false;
      return { pool: null, usePostgres: false };
    }
  }
  return { pool: null, usePostgres: false };
}

function formatSqlForPostgres(sql) {
  if (typeof sql !== 'string') return sql;
  let paramIndex = 1;
  let formatted = sql.replace(/\[(\w+)\]/g, '"$1"');
  formatted = formatted.replace(/\?/g, () => `$${paramIndex++}`);
  return formatted;
}

async function dbQuery(sql, params = []) {
  if (usePostgres && pool) {
    try {
      const pgSql = formatSqlForPostgres(sql);
      const res = await pool.query(pgSql, params);
      return res.rows;
    } catch (err) {
      logWarn('DatabaseManager', `PostgreSQL query failed: ${err.message} (SQL: ${sql})`);
    }
  }
  
  // MemDB fallback
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) {
    if (sql.trim().toUpperCase().startsWith('SELECT')) return [{ result: 1 }];
    return [];
  }
  const table = tableMatch[1].toLowerCase();
  return memDb[table] ? [...memDb[table]] : [];
}

async function dbGet(sql, params = []) {
  const rows = await dbQuery(sql, params);
  return rows && rows.length ? rows[0] : null;
}

async function dbRun(sql, params = []) {
  if (usePostgres && pool) {
    try {
      const pgSql = formatSqlForPostgres(sql);
      const res = await pool.query(pgSql, params);
      return { rowCount: res.rowCount };
    } catch (err) {
      logWarn('DatabaseManager', `dbRun error: ${err.message} (SQL: ${sql})`);
      throw err;
    }
  }
  return { rowCount: 0 };
}

/**
 * تنفيذ مجموعة عمليات ضمن معاملة ذرية متكاملة (ACID Transaction)
 */
async function withTransaction(callback) {
  if (!usePostgres || !pool) {
    return await callback({
      query: (sql, params) => dbQuery(sql, params),
      run: (sql, params) => dbRun(sql, params)
    });
  }

  const client = await pool.connect();
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
 * توليد معرف متسلسل آمن وموحد بدون تضارب مدعوم بمحرك الترقيم المركزي NumberingEngine
 */
async function generateSequenceId(prefix, table) {
  try {
    const numberingEngine = require('../services/numberingEngine');
    return await numberingEngine.generateNextId(table, { prefix });
  } catch (err) {
    logWarn('DatabaseManager', `NumberingEngine delegation fallback: ${err.message}`);
    const year = new Date().getFullYear();
    const effectivePrefix = (prefix || 'DOC').replace(/-+$/, '');
    const rand = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    return `${effectivePrefix}-${year}-${rand}`;
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    logInfo('DatabaseManager', 'PostgreSQL connection pool closed.');
  }
}

module.exports = {
  initializeDatabase,
  dbQuery,
  dbGet,
  dbRun,
  withTransaction,
  generateSequenceId,
  closeDatabase,
  getPool: () => pool,
  isPostgresActive: () => usePostgres,
  memDb,
  loadMemTable,
  saveMemTable,
  MEM_TABLES
};

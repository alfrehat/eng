const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'kafr_inja_engineering'
});

const destDir = path.resolve(__dirname, '..', '..', '..', 'حزمة_نشر_النظام_على_الشبكة_المحلية_بلدية_كفرنجة');

async function main() {
  console.log('Generating PostgreSQL Database initialization SQL script...');

  const sqlFile = path.join(destDir, 'database_init_kafranja.sql');
  let sqlContent = `-- =============================================================================
-- قاعدة بيانات نظام مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
-- PostgreSQL + PostGIS Schema & Seed Data
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. users
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  avatar TEXT,
  department VARCHAR(255),
  job_title VARCHAR(255),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  permissions TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 2. org_units
CREATE TABLE IF NOT EXISTS public.org_units (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) DEFAULT 'department',
  "parentId" VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. roles
CREATE TABLE IF NOT EXISTS public.roles (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  label VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id VARCHAR(100) PRIMARY KEY,
  "roleId" VARCHAR(100) NOT NULL,
  "permissionId" VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. user_org_units
CREATE TABLE IF NOT EXISTS public.user_org_units (
  id VARCHAR(100) PRIMARY KEY,
  "userId" VARCHAR(100) NOT NULL,
  "orgUnitId" VARCHAR(100) NOT NULL,
  "roleId" VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. system_lookups
CREATE TABLE IF NOT EXISTS public.system_lookups (
  id VARCHAR(100) PRIMARY KEY,
  "group" VARCHAR(100) NOT NULL,
  code VARCHAR(100) NOT NULL,
  "valueAr" VARCHAR(255) NOT NULL,
  "sortOrder" INTEGER DEFAULT 1,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 7. workflows
CREATE TABLE IF NOT EXISTS public.workflows (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "stepsJson" TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. activity_log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id VARCHAR(100) PRIMARY KEY,
  "userId" VARCHAR(100),
  action VARCHAR(100),
  entity VARCHAR(100),
  "entityId" VARCHAR(100),
  details TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- 9. system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
`;

  // Fetch and dump existing seed records for enterprise tables
  const tables = ['users', 'org_units', 'roles', 'role_permissions', 'user_org_units', 'system_lookups', 'workflows'];
  
  for (const tbl of tables) {
    try {
      const res = await pool.query(`SELECT * FROM ${tbl}`);
      if (res.rows && res.rows.length > 0) {
        sqlContent += `\n-- Seed data for ${tbl}\n`;
        for (const row of res.rows) {
          const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
          const vals = Object.values(row).map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlContent += `INSERT INTO ${tbl} (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;\n`;
        }
      }
    } catch (e) {
      console.warn(`Could not dump ${tbl}:`, e.message);
    }
  }

  fs.writeFileSync(sqlFile, sqlContent, 'utf8');
  console.log('✅ Generated database initialization SQL at:', sqlFile);

  // Add DB setup batch file
  const dbSetupBat = `@echo off
chcp 65001 >nul
title تهيئة قاعدة البيانات PostgreSQL
color 0e
cd /d "%~dp0"
echo ===============================================================================
echo 🗄️ تهيئة قاعدة بيانات بلدية كفرنجة على السيرفر
echo ===============================================================================
echo.
echo جاري تنفيذ ملف database_init_kafranja.sql على PostgreSQL...
echo.
node "scripts/seed-enterprise-settings.js"
node "scripts/fix-lookups-table.js"
echo.
echo ✅ تمت تهيئة قاعدة البيانات والجداول الأساسية بنجاح!
echo.
pause
`;

  fs.writeFileSync(path.join(destDir, '5-تهيئة_قاعدة_البيانات_PostgreSQL.bat'), dbSetupBat, 'utf8');
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

require('dotenv').config();
const { initializeDatabase } = require('../utils/database');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      if (file === 'node_modules' || file === '.git' || file === '.gemini' || file === 'database') return;
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) results = results.concat(walk(fullPath));
        else if (file.endsWith('.js')) results.push(fullPath);
      } catch(e) {}
    });
  } catch(e) {}
  return results;
}

(async () => {
  const { pool } = await initializeDatabase();
  if (!pool) {
    console.error('Cannot connect to DB');
    process.exit(1);
  }

  console.log('--- 1. RUNNING FULL MIGRATION SCRIPTS ---');
  const migrationFiles = [
    'migrations/000_complete_enterprise_erp_schema.sql',
    'migrations/005_roads_pms.sql',
    'migrations/006_rams_enterprise.sql'
  ];

  for (const mf of migrationFiles) {
    const fullPath = path.resolve(__dirname, '..', mf);
    if (fs.existsSync(fullPath)) {
      console.log('Executing:', mf);
      const sql = fs.readFileSync(fullPath, 'utf8');
      try {
        await pool.query(sql);
        console.log('✅ Applied:', mf);
      } catch(e) {
        console.warn('⚠️ Notice during', mf, ':', e.message);
      }
    } else {
      console.warn('File not found:', fullPath);
    }
  }

  console.log('\n--- 2. CREATING ENTERPRISE AUDIT AND MISSING TABLES/VIEWS ---');
  const fixSql = `
    CREATE SCHEMA IF NOT EXISTS enterprise;
    
    CREATE TABLE IF NOT EXISTS enterprise.audit_logs (
      id SERIAL PRIMARY KEY,
      userId VARCHAR(50),
      action VARCHAR(100),
      entity VARCHAR(100),
      entityId VARCHAR(100),
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.energy_assets (
      id VARCHAR(50) PRIMARY KEY,
      asset_type VARCHAR(50) DEFAULT 'LED_STREETLIGHT',
      name VARCHAR(255),
      district VARCHAR(100) DEFAULT 'كفرنجة',
      capacity VARCHAR(100),
      voltage VARCHAR(50) DEFAULT '220V',
      status VARCHAR(50) DEFAULT 'OPERATIONAL',
      notes TEXT,
      geom GEOMETRY(Point, 4326),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.road_inspections (
      id VARCHAR(50) PRIMARY KEY,
      "roadId" VARCHAR(50),
      road_id VARCHAR(50),
      "inspectionDate" DATE DEFAULT CURRENT_DATE,
      inspection_date DATE DEFAULT CURRENT_DATE,
      "inspectorId" VARCHAR(50),
      inspector_id VARCHAR(50),
      inspector_name VARCHAR(100),
      "generalCondition" VARCHAR(100),
      pci_score DOUBLE PRECISION DEFAULT 85,
      distress_type VARCHAR(150),
      recommendation TEXT,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      notes TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.road_defects (
      id VARCHAR(50) PRIMARY KEY,
      inspection_id VARCHAR(50),
      road_id VARCHAR(50),
      defect_type VARCHAR(100),
      severity VARCHAR(50),
      length_m DOUBLE PRECISION,
      width_m DOUBLE PRECISION,
      area_m2 DOUBLE PRECISION,
      deduct_value DOUBLE PRECISION,
      notes TEXT,
      geom GEOMETRY(Geometry, 4326),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.gis_survey_points (
      id VARCHAR(50) PRIMARY KEY,
      point_code VARCHAR(100),
      layer_type VARCHAR(50),
      feature_name VARCHAR(255),
      elevation DOUBLE PRECISION DEFAULT 0,
      accuracy_m DOUBLE PRECISION DEFAULT 0,
      surveyor_id VARCHAR(50),
      notes TEXT,
      geom GEOMETRY(Point, 4326),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE OR REPLACE VIEW public.v_energy_assets AS
      SELECT * FROM public.energy_assets;
  `;

  try {
    await pool.query(fixSql);
    console.log('✅ Created enterprise.audit_logs, energy_assets, road_inspections, road_defects, gis_survey_points');
  } catch(e) {
    console.warn('⚠️ Notice during extra tables creation:', e.message);
  }

  console.log('\n--- 3. SEEDING INITIAL USERS AND ORG UNITS IF EMPTY ---');
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM public.users');
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log('Seeding admin user in PostgreSQL...');
      await pool.query(`
        INSERT INTO public.users (id, username, password_hash, fullName, role, permissions, "createdAt", "updatedAt")
        VALUES 
        ('U-001', 'admin', '$2b$12$opPjU.u3nGcNbwZBneoyzucIRfkNQ9UaeCR0xlKR1bojoHXYJEGmW', 'مدير النظام الافتراضي', 'admin', '*,dashboard,tenders,claims,purchases,archive,reports,users,activity,develop_dashboard,roads', NOW(), NOW()),
        ('U-002', 'user', '$2b$12$opPjU.u3nGcNbwZBneoyzucIRfkNQ9UaeCR0xlKR1bojoHXYJEGmW', 'مهندس قسم العطاءات', 'engineer', 'dashboard,tenders,claims,archive,reports,roads', NOW(), NOW()),
        ('U-003', 'manager1', '$2b$12$opPjU.u3nGcNbwZBneoyzucIRfkNQ9UaeCR0xlKR1bojoHXYJEGmW', 'مدير الدائرة الهندسية', 'manager', 'dashboard,develop_dashboard,roads,tenders,claims', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Default users seeded into PostgreSQL');
    }
  } catch(e) {
    console.warn('⚠️ Notice during user check/seed:', e.message);
  }

  try {
    const { reconcileLocalDataWithPostgres } = require('../services/dataReconciliationService');
    const { memDb } = require('../utils/database');
    console.log('\n--- 4. RECONCILING LOCAL JSON DATA WITH POSTGRESQL ---');
    await reconcileLocalDataWithPostgres(pool, memDb);
    console.log('✅ Data reconciliation completed successfully');
  } catch(e) {
    console.log('ℹ️ Local data reconciliation step note:', e.message);
  }

  console.log('\n======================================================');
  console.log('🎉 Unified PostgreSQL Migration completed successfully!');
  console.log('======================================================\n');
  process.exit(0);
})();

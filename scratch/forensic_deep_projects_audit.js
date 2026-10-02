const { dbQuery, dbGet, isPostgresActive } = require('../utils/database');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔎 DEEP POSTGRESQL CATALOG & MIGRATIONS FORENSIC INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check migrations 007 to 012 contents vs migration 028
  const migrationFiles = [
    '007_projects_enterprise.sql',
    '008_project_portfolio_planning.sql',
    '009_project_prioritization.sql',
    '010_project_financial_programming.sql',
    '011_project_dependencies.sql',
    '012_project_scheduling.sql',
    '028_canonical_projects_enterprise_schema.sql'
  ];

  console.log('--- Checking Migration Files in migrations/ ---');
  for (const mf of migrationFiles) {
    const fullPath = path.join(__dirname, '..', 'migrations', mf);
    const exists = fs.existsSync(fullPath);
    console.log(`Migration [${mf}]: ${exists ? 'EXISTS (' + fs.statSync(fullPath).size + ' bytes)' : 'MISSING'}`);
  }

  // 2. Check migrations table in PostgreSQL (if tracking table exists)
  console.log('\n--- Checking Migration Tracking Tables in Live PostgreSQL ---');
  const trackingTables = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name LIKE '%migration%' OR table_name LIKE '%version%')
  `);
  console.log('Migration tracking tables:', trackingTables);

  for (const t of trackingTables) {
    try {
      const rows = await dbQuery(`SELECT * FROM public."${t.table_name}" ORDER BY 1 DESC LIMIT 10`);
      console.log(`Rows in ${t.table_name}:`, rows);
    } catch (e) {
      console.log(`Could not read ${t.table_name}:`, e.message);
    }
  }

  // 3. Inspect all 14 project tables in PostgreSQL catalog
  const targetTables = [
    'projects',
    'project_milestones',
    'project_risks',
    'project_progress_logs',
    'project_portfolios',
    'project_portfolio_projects',
    'project_plans',
    'project_plan_projects',
    'project_priority_criteria',
    'project_priority_scores',
    'project_priority_results',
    'project_financial_programs',
    'project_dependencies',
    'project_schedules',
    'v2_projects'
  ];

  console.log('\n--- Inspecting 14 Projects Tables + v2_projects in pg_catalog ---');
  for (const tbl of targetTables) {
    const tableExists = await dbGet(`
      SELECT relname, relkind, reltuples::bigint as est_rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1
    `, [tbl]);

    if (!tableExists) {
      console.log(`❌ Table [${tbl}] DOES NOT EXIST in PostgreSQL!`);
      continue;
    }

    const countRow = await dbGet(`SELECT count(*)::bigint as actual_count FROM public."${tbl}"`);
    
    // Constraints on tbl
    const constraints = await dbQuery(`
      SELECT conname, contype, 
             pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1
      ORDER BY contype, conname
    `, [tbl]);

    // Foreign Keys Outbound
    const outboundFKs = constraints.filter(c => c.contype === 'f');

    // Foreign Keys Inbound (pointing to this table)
    const inboundFKs = await dbQuery(`
      SELECT c.conname, 
             t_source.relname as source_table,
             pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t_source ON t_source.oid = c.conrelid
      JOIN pg_class t_target ON t_target.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND t_target.relname = $1 AND c.contype = 'f'
      ORDER BY t_source.relname, c.conname
    `, [tbl]);

    // Indexes on tbl
    const indexes = await dbQuery(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname
    `, [tbl]);

    console.log(`\n📋 TABLE: [${tbl}]`);
    console.log(`   - Kind: ${tableExists.relkind === 'r' ? 'Regular Table' : tableExists.relkind}`);
    console.log(`   - Exact Row Count: ${countRow.actual_count}`);
    console.log(`   - Constraints Count: ${constraints.length}`);
    constraints.forEach(c => console.log(`     [${c.contype}] ${c.conname}: ${c.definition}`));
    console.log(`   - Inbound FKs Count: ${inboundFKs.length}`);
    inboundFKs.forEach(f => console.log(`     <- from [${f.source_table}].${f.conname}: ${f.definition}`));
    console.log(`   - Indexes Count: ${indexes.length}`);
    indexes.forEach(i => console.log(`     INDEX ${i.indexname}: ${i.indexdef}`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

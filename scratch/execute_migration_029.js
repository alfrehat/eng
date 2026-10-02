const fs = require('fs');
const path = require('path');
const { dbQuery, withTransaction, closeDatabase } = require('../utils/database');

async function executeMigration029() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 EXECUTING CANONICAL MIGRATION 029: PROJECTS REFERENTIAL INTEGRITY');
  console.log('═══════════════════════════════════════════════════════════════');

  const fksToVerify = [
    { name: 'fk_projects_tender', table: 'projects', col: 'tender_id', refTable: 'tenders', refCol: 'id', delAction: 'SET NULL' },
    { name: 'fk_projects_contract', table: 'projects', col: 'contract_id', refTable: 'contracts', refCol: 'id', delAction: 'SET NULL' },
    { name: 'fk_projects_budget_line', table: 'projects', col: 'budget_line_id', refTable: 'directorate_budget_lines', refCol: 'id', delAction: 'SET NULL' },
    { name: 'fk_project_milestones_project', table: 'project_milestones', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_risks_project', table: 'project_risks', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_progress_logs_project', table: 'project_progress_logs', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_portfolio_projects_portfolio', table: 'project_portfolio_projects', col: 'portfolio_id', refTable: 'project_portfolios', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_portfolio_projects_project', table: 'project_portfolio_projects', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_plan_projects_plan', table: 'project_plan_projects', col: 'plan_id', refTable: 'project_plans', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_plan_projects_project', table: 'project_plan_projects', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_priority_scores_project', table: 'project_priority_scores', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_priority_scores_criterion', table: 'project_priority_scores', col: 'criterion_id', refTable: 'project_priority_criteria', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_priority_results_project', table: 'project_priority_results', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_financial_programs_plan', table: 'project_financial_programs', col: 'plan_id', refTable: 'project_plans', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_financial_programs_project', table: 'project_financial_programs', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_dependencies_predecessor', table: 'project_dependencies', col: 'predecessor_project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_dependencies_successor', table: 'project_dependencies', col: 'successor_project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' },
    { name: 'fk_project_schedules_project', table: 'project_schedules', col: 'project_id', refTable: 'projects', refCol: 'id', delAction: 'CASCADE' }
  ];

  // 1. Preflight validations
  console.log('\n--- 1. Preflight Validations: Target relkinds & Orphan Scan ---');
  for (const item of fksToVerify) {
    // Check target table relkind
    const targetCheck = await dbQuery(`
      SELECT c.relname, c.relkind 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE n.nspname = 'public' AND c.relname = $1
    `, [item.refTable]);

    if (targetCheck.length === 0 || targetCheck[0].relkind !== 'r') {
      throw new Error(`Target ${item.refTable} is not a valid regular table (relkind: ${targetCheck[0]?.relkind || 'none'})`);
    }

    // Check orphan records
    const orphanCheck = await dbQuery(`
      SELECT COUNT(*) as orphans
      FROM public.${item.table} s
      WHERE s.${item.col} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.${item.refTable} t WHERE t.${item.refCol} = s.${item.col}
        )
    `);
    const orphans = parseInt(orphanCheck[0].orphans, 10);
    if (orphans > 0) {
      throw new Error(`Orphan records detected on ${item.table}.${item.col} -> ${item.refTable}.${item.refCol} (Count: ${orphans})`);
    }
    console.log(`  ✅ Preflight OK: ${item.table}.${item.col} -> ${item.refTable}.${item.refCol} (relkind: 'r', orphans: 0)`);
  }

  // 2. Read migration SQL
  const sqlPath = path.join(__dirname, '../migrations/029_projects_reference_integrity.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // 3. Execute inside an atomic transaction
  console.log('\n--- 2. Applying Migration 029 within Atomic Transaction ---');
  await withTransaction(async (client) => {
    await client.query(sql);
  });
  console.log('  ✅ SQL Migration executed successfully.');

  // 4. Verify in pg_constraint
  console.log('\n--- 3. Verifying Constraints in pg_constraint ---');
  for (const item of fksToVerify) {
    const res = await dbQuery(`
      SELECT 
        con.conname,
        c_src.relname AS source_table,
        a_src.attname AS source_column,
        c_ref.relname AS target_table,
        a_ref.attname AS target_column,
        con.confdeltype,
        con.confupdtype
      FROM pg_constraint con
      JOIN pg_class c_src ON c_src.oid = con.conrelid
      JOIN pg_class c_ref ON c_ref.oid = con.confrelid
      JOIN pg_attribute a_src ON a_src.attrelid = con.conrelid AND a_src.attnum = ANY(con.conkey)
      JOIN pg_attribute a_ref ON a_ref.attrelid = con.confrelid AND a_ref.attnum = ANY(con.confkey)
      WHERE con.conname = $1
    `, [item.name]);

    if (res.length === 0) {
      throw new Error(`Constraint ${item.name} not found in pg_constraint!`);
    }

    const row = res[0];
    const delActionMap = { 'c': 'CASCADE', 'n': 'SET NULL', 'a': 'NO ACTION', 'r': 'RESTRICT' };
    const updActionMap = { 'c': 'CASCADE', 'n': 'SET NULL', 'a': 'NO ACTION', 'r': 'RESTRICT' };
    const del = delActionMap[row.confdeltype] || row.confdeltype;
    const upd = updActionMap[row.confupdtype] || row.confupdtype;

    console.log(`  ✅ Verified: [${row.conname}] ${row.source_table}.${row.source_column} -> ${row.target_table}.${row.target_column} (ON DELETE ${del}, ON UPDATE ${upd})`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎯 ALL 18 PHYSICAL FOREIGN KEYS SUCCESSFULLY CREATED AND VERIFIED!');
  console.log('═══════════════════════════════════════════════════════════════');

  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
}

executeMigration029().catch(async (err) => {
  console.error('\n❌ MIGRATION EXECUTION FAILED:', err);
  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
  process.exit(1);
});

const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT: DUPLICATES, ORPHANS & INTEGRITY IN pg_catalog');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check for Duplicate Tables in public schema
  console.log('--- 1. Checking for Duplicate Project Tables ---');
  const dupTables = await dbQuery(`
    SELECT table_name, count(*) as cnt
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'projects', 'project_milestones', 'project_risks', 'project_progress_logs',
      'project_portfolios', 'project_portfolio_projects', 'project_plans', 'project_plan_projects',
      'project_priority_criteria', 'project_priority_scores', 'project_priority_results',
      'project_financial_programs', 'project_dependencies', 'project_schedules'
    )
    GROUP BY table_name
    HAVING count(*) > 1
  `);
  console.log(`Duplicate project tables: ${dupTables.length}`);

  // 2. Check for Duplicate Indexes (same table, same column expression)
  console.log('\n--- 2. Checking for Duplicate Indexes ---');
  const dupIndexes = await dbQuery(`
    SELECT tablename, indexdef, count(*) as cnt
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename LIKE 'project%'
    GROUP BY tablename, indexdef
    HAVING count(*) > 1
  `);
  console.log(`Duplicate project indexes: ${dupIndexes.length}`);
  if (dupIndexes.length > 0) console.log(dupIndexes);

  // 3. Check for Duplicate Constraints
  console.log('\n--- 3. Checking for Duplicate Constraints ---');
  const dupConstraints = await dbQuery(`
    SELECT t.relname as table_name, c.conname, count(*) as cnt
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname LIKE 'project%'
    GROUP BY t.relname, c.conname
    HAVING count(*) > 1
  `);
  console.log(`Duplicate project constraints: ${dupConstraints.length}`);
  if (dupConstraints.length > 0) console.log(dupConstraints);

  // 4. Check for Orphaned Sequences
  console.log('\n--- 4. Checking for Orphaned Sequences ---');
  const orphanedSeq = await dbQuery(`
    SELECT s.relname AS sequence_name
    FROM pg_class s
    JOIN pg_namespace n ON n.oid = s.relnamespace
    WHERE s.relkind = 'S' AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = s.oid AND d.deptype IN ('a', 'i')
      )
  `);
  console.log(`Sequences in public schema: ${orphanedSeq.length}`);
  orphanedSeq.forEach(s => console.log(`   Sequence: ${s.sequence_name}`));

  // 5. Check for Duplicate Rows in Project Tables
  console.log('\n--- 5. Checking for Duplicate Rows (PKs) in Project Tables ---');
  const projectTables = [
    'projects', 'project_milestones', 'project_risks', 'project_progress_logs',
    'project_portfolios', 'project_portfolio_projects', 'project_plans', 'project_plan_projects',
    'project_priority_criteria', 'project_priority_scores', 'project_priority_results',
    'project_financial_programs', 'project_dependencies', 'project_schedules'
  ];

  for (const tbl of projectTables) {
    const dupPK = await dbQuery(`
      SELECT id, count(*) as cnt
      FROM public."${tbl}"
      GROUP BY id
      HAVING count(*) > 1
    `);
    console.log(`   Table [${tbl}] duplicate PK count: ${dupPK.length}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

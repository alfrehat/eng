const { dbQuery } = require('../utils/database');

async function main() {
  const expectedTables = [
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
    'project_financial_sources',
    'project_dependencies',
    'project_schedules'
  ];

  console.log('--- Checking Canonical Projects Tables Status in PostgreSQL ---');
  for (const tbl of expectedTables) {
    const res = await dbQuery(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [tbl]);
    if (res.length > 0) {
      console.log(`✅ EXISTS: ${tbl} (${res[0].table_type})`);
    } else {
      console.log(`❌ MISSING: ${tbl}`);
    }
  }

  console.log('\n--- Checking Inbound Foreign Keys to v2_projects ---');
  const fks = await dbQuery(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'v2_projects';
  `);
  console.log('Inbound FKs to v2_projects:', fks);

  const rowCount = await dbQuery('SELECT COUNT(*) as cnt FROM public.v2_projects');
  console.log('v2_projects row count:', rowCount[0].cnt);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

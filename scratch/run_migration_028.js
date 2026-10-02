const fs = require('fs');
const path = require('path');
const { dbQuery, closeDatabase } = require('../utils/database');

async function runMigration() {
  console.log('Running Migration 028: Canonical Projects Enterprise Schema...');
  let sql = fs.readFileSync(path.join(__dirname, '../migrations/028_canonical_projects_enterprise_schema.sql'), 'utf-8');
  
  // Strip comments
  sql = sql.replace(/--.*$/gm, '');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, ' ').substring(0, 70);
    console.log('Executing:', preview + '...');
    await dbQuery(statement);
  }

  console.log('✅ Migration 028 applied successfully.');

  // Verify created tables
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
    'project_dependencies',
    'project_schedules'
  ];

  for (const t of expectedTables) {
    const res = await dbQuery(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [t]);
    if (res.length > 0) {
      console.log(`  ✅ Verified table: ${t}`);
    } else {
      throw new Error(`Table ${t} was not found!`);
    }
  }

  // Verify criteria count
  const crits = await dbQuery('SELECT COUNT(*) as count FROM public.project_priority_criteria');
  console.log(`  ✅ Criteria seeded: ${crits[0].count}`);

  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Migration 028 failed:', err);
  process.exit(1);
});

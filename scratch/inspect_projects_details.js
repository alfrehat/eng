const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  const tbls = [
    'projects',
    'project_milestones',
    'project_risks',
    'project_progress_logs',
    'project_portfolios',
    'project_portfolio_projects',
    'project_plans',
    'project_plan_projects',
    'project_priority_criteria'
  ];

  for (const tbl of tbls) {
    console.log(`\n================== TABLE: ${tbl} ==================`);
    const count = await dbGet(`SELECT count(*)::bigint as cnt FROM public."${tbl}"`);
    console.log(`Row count: ${count.cnt}`);

    const constraints = await dbQuery(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1
      ORDER BY contype, conname
    `, [tbl]);

    console.log(`Constraints (${constraints.length}):`);
    constraints.forEach(c => console.log(`  [${c.contype}] ${c.conname}: ${c.definition}`));

    const inbound = await dbQuery(`
      SELECT c.conname, t_source.relname as source_table, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t_source ON t_source.oid = c.conrelid
      JOIN pg_class t_target ON t_target.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND t_target.relname = $1 AND c.contype = 'f'
      ORDER BY t_source.relname, c.conname
    `, [tbl]);

    console.log(`Inbound FKs (${inbound.length}):`);
    inbound.forEach(f => console.log(`  <- ${f.source_table}.${f.conname}: ${f.definition}`));

    const indexes = await dbQuery(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname
    `, [tbl]);

    console.log(`Indexes (${indexes.length}):`);
    indexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));
  }

  process.exit(0);
}

main();

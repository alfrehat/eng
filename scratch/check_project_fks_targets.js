const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 INVESTIGATING TARGET RELATIONS FOR TENDER, CONTRACT, BUDGET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const relationsToCheck = [
    'tenders',
    'v2_tenders',
    'contracts',
    'v2_contracts',
    'construction_contracts',
    'budget_lines',
    'budget_allocations'
  ];

  for (const rel of relationsToCheck) {
    const info = await dbGet(`
      SELECT c.relname, c.relkind, 
             CASE c.relkind 
               WHEN 'r' THEN 'Regular Table'
               WHEN 'v' THEN 'View'
               WHEN 'm' THEN 'Materialized View'
               WHEN 'f' THEN 'Foreign Table'
               ELSE c.relkind::text
             END as kind_desc
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1
    `, [rel]);

    if (!info) {
      console.log(`❌ Relation [${rel}]: DOES NOT EXIST in PostgreSQL`);
      continue;
    }

    let rowCount = 0;
    try {
      const cnt = await dbGet(`SELECT count(*)::bigint as cnt FROM public."${rel}"`);
      rowCount = cnt.actual_count || cnt.cnt;
    } catch (e) {
      rowCount = `Error: ${e.message}`;
    }

    // Constraints on this relation
    const constraints = await dbQuery(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1
      ORDER BY contype, conname
    `, [rel]);

    console.log(`\n📋 Relation: [${rel}] (${info.kind_desc})`);
    console.log(`   - Row count: ${rowCount}`);
    console.log(`   - Constraints: ${constraints.length}`);
    constraints.forEach(c => console.log(`     [${c.contype}] ${c.conname}: ${c.definition}`));
  }

  // Check how projects table connects to tenders, contracts, and budget in projectsEngineService
  console.log('\n--- Checking projects table columns for tender_id, contract_id, budget_line_id ---');
  const cols = await dbQuery(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name IN ('tender_id', 'contract_id', 'budget_line_id')
    ORDER BY column_name
  `);
  cols.forEach(c => console.log(`   Column: ${c.column_name} (${c.data_type}), Nullable: ${c.is_nullable}, Default: ${c.column_default}`));

  // Check if any FK constraint exists on projects referencing other tables
  const projectFKs = await dbQuery(`
    SELECT c.conname, 
           pg_get_constraintdef(c.oid) as definition,
           t_target.relname as target_table
    FROM pg_constraint c
    JOIN pg_class t_source ON t_source.oid = c.conrelid
    JOIN pg_class t_target ON t_target.oid = c.confrelid
    WHERE t_source.relname = 'projects' AND c.contype = 'f'
  `);
  console.log(`\nDirect Foreign Key constraints on public.projects: ${projectFKs.length}`);
  projectFKs.forEach(f => console.log(`   ${f.conname}: ${f.definition} -> ${f.target_table}`));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

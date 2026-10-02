const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 DEEP FORENSIC ANALYSIS OF public.v2_projects');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Table existence and row count
  const tblInfo = await dbGet(`
    SELECT c.relname, c.relkind, c.reltuples
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v2_projects'
  `);
  console.log('Table existence in public schema:', tblInfo);

  const rowCount = await dbGet('SELECT count(*)::bigint as count FROM public.v2_projects');
  console.log('Row count:', rowCount.count);

  // 2. Outbound Foreign Keys (from v2_projects)
  const outboundFKs = await dbQuery(`
    SELECT c.conname, pg_get_constraintdef(c.oid) as definition, t_target.relname as target_table
    FROM pg_constraint c
    JOIN pg_class t_source ON t_source.oid = c.conrelid
    JOIN pg_class t_target ON t_target.oid = c.confrelid
    WHERE t_source.relname = 'v2_projects' AND c.contype = 'f'
  `);
  console.log(`\nOutbound FKs from v2_projects (${outboundFKs.length}):`);
  outboundFKs.forEach(f => console.log(`   ${f.conname}: ${f.definition} -> ${f.target_table}`));

  // 3. Inbound Foreign Keys (pointing to v2_projects)
  const inboundFKs = await dbQuery(`
    SELECT c.conname, t_source.relname as source_table, pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    JOIN pg_class t_source ON t_source.oid = c.conrelid
    JOIN pg_class t_target ON t_target.oid = c.confrelid
    WHERE t_target.relname = 'v2_projects' AND c.contype = 'f'
    ORDER BY t_source.relname
  `);
  console.log(`\nInbound FKs to v2_projects (${inboundFKs.length}):`);
  inboundFKs.forEach(f => console.log(`   <- ${f.source_table}.${f.conname}: ${f.definition}`));

  // 4. Views depending on v2_projects via pg_depend
  const dependentViews = await dbQuery(`
    SELECT DISTINCT v.relname AS view_name
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class v ON v.oid = r.ev_class
    JOIN pg_class t ON t.oid = d.refobjid
    WHERE t.relname = 'v2_projects' AND v.relkind IN ('v', 'm')
  `);
  console.log(`\nViews depending on v2_projects (${dependentViews.length}):`);
  dependentViews.forEach(v => console.log(`   View: ${v.view_name}`));

  // 5. Triggers on v2_projects
  const triggers = await dbQuery(`
    SELECT tgname, pg_get_triggerdef(oid) as def
    FROM pg_trigger
    WHERE tgrelid = 'public.v2_projects'::regclass AND NOT tgisinternal
  `);
  console.log(`\nTriggers on v2_projects (${triggers.length}):`);
  triggers.forEach(t => console.log(`   Trigger: ${t.tgname}: ${t.def}`));

  // 6. Indexes on v2_projects
  const indexes = await dbQuery(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'v2_projects'
  `);
  console.log(`\nIndexes on v2_projects (${indexes.length}):`);
  indexes.forEach(i => console.log(`   ${i.indexname}: ${i.indexdef}`));

  // 7. Check if any row exists in any table referencing v2_projects
  console.log('\n--- Checking Row Count of Inbound Tables referencing v2_projects ---');
  for (const f of inboundFKs) {
    try {
      const cnt = await dbGet(`SELECT count(*)::bigint as cnt FROM public."${f.source_table}"`);
      console.log(`   ${f.source_table}: ${cnt.cnt} rows`);
    } catch (e) {
      console.log(`   ${f.source_table}: Error (${e.message})`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

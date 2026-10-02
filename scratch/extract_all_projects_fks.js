const { dbQuery } = require('../utils/database');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 LIVE POSTGRESQL CATALOG: ALL FOREIGN KEY CONSTRAINTS ON 14 TABLES');
  console.log('═══════════════════════════════════════════════════════════════\n');

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
    'project_schedules'
  ];

  const query = `
    SELECT 
      n_src.nspname AS source_schema,
      t_src.relname AS source_table,
      a_src.attname AS source_column,
      n_tgt.nspname AS target_schema,
      t_tgt.relname AS target_table,
      a_tgt.attname AS target_column,
      c.conname AS constraint_name,
      t_tgt.relkind AS target_relkind,
      CASE t_tgt.relkind
        WHEN 'r' THEN 'Regular Table'
        WHEN 'v' THEN 'View'
        WHEN 'm' THEN 'Materialized View'
        WHEN 'f' THEN 'Foreign Table'
        ELSE t_tgt.relkind::text
      END AS target_kind_desc,
      CASE c.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE c.confdeltype::text
      END AS on_delete,
      CASE c.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE c.confupdtype::text
      END AS on_update
    FROM pg_constraint c
    JOIN pg_class t_src ON t_src.oid = c.conrelid
    JOIN pg_namespace n_src ON n_src.oid = t_src.relnamespace
    JOIN pg_class t_tgt ON t_tgt.oid = c.confrelid
    JOIN pg_namespace n_tgt ON n_tgt.oid = t_tgt.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a_src ON a_src.attrelid = t_src.oid AND a_src.attnum = k.attnum
    JOIN unnest(c.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = k.ord
    JOIN pg_attribute a_tgt ON a_tgt.attrelid = t_tgt.oid AND a_tgt.attnum = fk.attnum
    WHERE c.contype = 'f'
      AND n_src.nspname = 'public'
      AND t_src.relname = ANY($1)
    ORDER BY t_src.relname, c.conname;
  `;

  const rows = await dbQuery(query, [targetTables]);

  console.log(`Total FOREIGN KEY constraints found on the 14 tables: ${rows.length}`);
  if (rows.length === 0) {
    console.log('Zero foreign key constraints found directly defined on these 14 tables.');
  } else {
    rows.forEach((r, idx) => {
      console.log(`\n[${idx + 1}] Constraint: ${r.constraint_name}`);
      console.log(`    Source: ${r.source_schema}.${r.source_table} (${r.source_column})`);
      console.log(`    Target: ${r.target_schema}.${r.target_table} (${r.target_column})`);
      console.log(`    Target Kind: ${r.target_kind_desc} (relkind: '${r.target_relkind}')`);
      console.log(`    ON DELETE: ${r.on_delete} | ON UPDATE: ${r.on_update}`);
    });
  }

  // Also query inbound FKs to these 14 tables
  console.log('\n---------------------------------------------------------------');
  console.log('INBOUND FOREIGN KEYS (Tables outside pointing TO the 14 tables):');
  const inboundQuery = `
    SELECT 
      n_src.nspname AS source_schema,
      t_src.relname AS source_table,
      a_src.attname AS source_column,
      n_tgt.nspname AS target_schema,
      t_tgt.relname AS target_table,
      a_tgt.attname AS target_column,
      c.conname AS constraint_name
    FROM pg_constraint c
    JOIN pg_class t_src ON t_src.oid = c.conrelid
    JOIN pg_namespace n_src ON n_src.oid = t_src.relnamespace
    JOIN pg_class t_tgt ON t_tgt.oid = c.confrelid
    JOIN pg_namespace n_tgt ON n_tgt.oid = t_tgt.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a_src ON a_src.attrelid = t_src.oid AND a_src.attnum = k.attnum
    JOIN unnest(c.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = k.ord
    JOIN pg_attribute a_tgt ON a_tgt.attrelid = t_tgt.oid AND a_tgt.attnum = fk.attnum
    WHERE c.contype = 'f'
      AND n_tgt.nspname = 'public'
      AND t_tgt.relname = ANY($1)
      AND t_src.relname != ALL($1)
    ORDER BY t_tgt.relname, c.conname;
  `;
  const inboundRows = await dbQuery(inboundQuery, [targetTables]);
  console.log(`Total inbound FKs from outside tables: ${inboundRows.length}`);
  inboundRows.forEach(r => console.log(`   <- ${r.source_schema}.${r.source_table}.${r.source_column} -> ${r.target_schema}.${r.target_table}.${r.target_column} (${r.constraint_name})`));

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

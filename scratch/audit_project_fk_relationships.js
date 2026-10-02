const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT OF THE 18 POTENTIAL FOREIGN KEY RELATIONSHIPS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const relationships = [
    // External
    { sourceTable: 'projects', sourceCol: 'tender_id', targetTable: 'tenders', targetCol: 'id', desc: 'Project -> Tender' },
    { sourceTable: 'projects', sourceCol: 'contract_id', targetTable: 'contracts', targetCol: 'id', desc: 'Project -> Contract' },
    { sourceTable: 'projects', sourceCol: 'budget_line_id', targetTable: 'directorate_budget_lines', targetCol: 'id', desc: 'Project -> Directorate Budget Line' },
    
    // Internal
    { sourceTable: 'project_milestones', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Milestone -> Project' },
    { sourceTable: 'project_risks', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Risk -> Project' },
    { sourceTable: 'project_progress_logs', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Progress Log -> Project' },
    { sourceTable: 'project_portfolio_projects', sourceCol: 'portfolio_id', targetTable: 'project_portfolios', targetCol: 'id', desc: 'Portfolio Junction -> Portfolio' },
    { sourceTable: 'project_portfolio_projects', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Portfolio Junction -> Project' },
    { sourceTable: 'project_plan_projects', sourceCol: 'plan_id', targetTable: 'project_plans', targetCol: 'id', desc: 'Plan Junction -> Plan' },
    { sourceTable: 'project_plan_projects', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Plan Junction -> Project' },
    { sourceTable: 'project_priority_scores', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Score -> Project' },
    { sourceTable: 'project_priority_scores', sourceCol: 'criterion_id', targetTable: 'project_priority_criteria', targetCol: 'id', desc: 'Score -> Criterion' },
    { sourceTable: 'project_priority_results', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Priority Result -> Project' },
    { sourceTable: 'project_financial_programs', sourceCol: 'plan_id', targetTable: 'project_plans', targetCol: 'id', desc: 'Financial Program -> Plan' },
    { sourceTable: 'project_financial_programs', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Financial Program -> Project' },
    { sourceTable: 'project_dependencies', sourceCol: 'predecessor_project_id', targetTable: 'projects', targetCol: 'id', desc: 'Dependency -> Predecessor Project' },
    { sourceTable: 'project_dependencies', sourceCol: 'successor_project_id', targetTable: 'projects', targetCol: 'id', desc: 'Dependency -> Successor Project' },
    { sourceTable: 'project_schedules', sourceCol: 'project_id', targetTable: 'projects', targetCol: 'id', desc: 'Schedule -> Project' }
  ];

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    console.log(`\n───────────────────────────────────────────────────────────────`);
    console.log(`[${i + 1}] ${rel.desc}`);
    console.log(`    Relation: public.${rel.sourceTable}.${rel.sourceCol} ➔ public.${rel.targetTable}.${rel.targetCol}`);

    // 1. Check Source Column Definition
    const srcCol = await dbGet(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [rel.sourceTable, rel.sourceCol]);

    // 2. Check Target Table and Column Definition
    const tgtTbl = await dbGet(`
      SELECT c.relname, c.relkind, 
             CASE c.relkind 
               WHEN 'r' THEN 'Regular Table'
               WHEN 'v' THEN 'View'
               WHEN 'm' THEN 'Materialized View'
               ELSE c.relkind::text 
             END as kind_desc
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1
    `, [rel.targetTable]);

    const tgtCol = await dbGet(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [rel.targetTable, rel.targetCol]);

    // 3. Check for Physical FK in pg_constraint
    const fkConstraint = await dbGet(`
      SELECT c.conname, pg_get_constraintdef(c.oid) as def,
             c.confdeltype, c.confupdtype
      FROM pg_constraint c
      JOIN pg_class t_src ON t_src.oid = c.conrelid
      JOIN pg_class t_tgt ON t_tgt.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = t_src.relnamespace
      WHERE n.nspname = 'public'
        AND t_src.relname = $1
        AND t_tgt.relname = $2
        AND c.contype = 'f'
        AND EXISTS (
          SELECT 1 FROM unnest(c.conkey) k
          JOIN pg_attribute a ON a.attrelid = t_src.oid AND a.attnum = k
          WHERE a.attname = $3
        )
    `, [rel.sourceTable, rel.targetTable, rel.sourceCol]);

    // 4. Check for Orphaned Records
    let orphanCount = 0;
    let sampleOrphans = [];
    if (srcCol && tgtTbl) {
      try {
        const orphanRes = await dbQuery(`
          SELECT s."${rel.sourceCol}" as orphan_val, count(*) as count
          FROM public."${rel.sourceTable}" s
          LEFT JOIN public."${rel.targetTable}" t ON t."${rel.targetCol}" = s."${rel.sourceCol}"
          WHERE s."${rel.sourceCol}" IS NOT NULL AND t."${rel.targetCol}" IS NULL
          GROUP BY s."${rel.sourceCol}"
        `);
        orphanCount = orphanRes.reduce((acc, r) => acc + parseInt(r.count, 10), 0);
        sampleOrphans = orphanRes.map(r => `${r.orphan_val} (${r.count} rows)`);
      } catch (e) {
        orphanCount = `Error: ${e.message}`;
      }
    }

    console.log(`    Source Column: ${srcCol ? `${srcCol.data_type}(${srcCol.character_maximum_length || ''}) | Nullable: ${srcCol.is_nullable}` : 'NOT FOUND'}`);
    console.log(`    Target Relation: ${tgtTbl ? `${tgtTbl.kind_desc} [${rel.targetTable}]` : 'NOT FOUND'} | Column: ${tgtCol ? `${tgtCol.data_type}(${tgtCol.character_maximum_length || ''})` : 'NOT FOUND'}`);
    console.log(`    Physical FK Constraint: ${fkConstraint ? `EXISTS: ${fkConstraint.conname} (${fkConstraint.def})` : 'NONE (Physical FK is absent)'}`);
    console.log(`    Orphaned Records Count: ${orphanCount} ${sampleOrphans.length > 0 ? `| Samples: ${sampleOrphans.join(', ')}` : ''}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal in audit:', err);
  process.exit(1);
});

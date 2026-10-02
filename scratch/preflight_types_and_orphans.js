const { dbQuery, withTransaction, closeDatabase } = require('../utils/database');

async function preflight() {
  console.log('--- PREFLIGHT: Inspecting Column Types & Typmods ---');

  const pairs = [
    { sourceTable: 'projects', sourceCol: 'tender_id', targetTable: 'tenders', targetCol: 'id' },
    { sourceTable: 'projects', sourceCol: 'contract_id', targetTable: 'contracts', targetCol: 'id' },
    { sourceTable: 'projects', sourceCol: 'budget_line_id', targetTable: 'directorate_budget_lines', targetCol: 'id' }
  ];

  for (const pair of pairs) {
    const sCols = await dbQuery(`
      SELECT table_name, column_name, data_type, character_maximum_length, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [pair.sourceTable, pair.sourceCol]);

    const tCols = await dbQuery(`
      SELECT table_name, column_name, data_type, character_maximum_length, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [pair.targetTable, pair.targetCol]);

    console.log(`Pair: ${pair.sourceTable}.${pair.sourceCol} -> ${pair.targetTable}.${pair.targetCol}`);
    console.log('  Source:', sCols[0]);
    console.log('  Target:', tCols[0]);
  }

  console.log('\n--- TESTING FK CREATION IN TRANSACTION (DRY RUN) ---');
  await withTransaction(async (client) => {
    // Test external 3
    console.log('Testing FK: projects.tender_id -> tenders.id...');
    await client.query(`
      ALTER TABLE public.projects
      ADD CONSTRAINT fk_projects_tender
      FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE SET NULL
    `);
    console.log('  ✅ SUCCESS: fk_projects_tender created without error.');

    console.log('Testing FK: projects.contract_id -> contracts.id...');
    await client.query(`
      ALTER TABLE public.projects
      ADD CONSTRAINT fk_projects_contract
      FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL
    `);
    console.log('  ✅ SUCCESS: fk_projects_contract created without error.');

    console.log('Testing FK: projects.budget_line_id -> directorate_budget_lines.id...');
    await client.query(`
      ALTER TABLE public.projects
      ADD CONSTRAINT fk_projects_budget_line
      FOREIGN KEY (budget_line_id) REFERENCES public.directorate_budget_lines(id) ON DELETE SET NULL
    `);
    console.log('  ✅ SUCCESS: fk_projects_budget_line created without error.');

    // Test internal 15
    const internalFKs = [
      { t: 'project_milestones', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_milestones_project' },
      { t: 'project_risks', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_risks_project' },
      { t: 'project_progress_logs', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_progress_logs_project' },
      { t: 'project_portfolio_projects', c: 'portfolio_id', refT: 'project_portfolios', refC: 'id', name: 'fk_ppp_portfolio' },
      { t: 'project_portfolio_projects', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_ppp_project' },
      { t: 'project_plan_projects', c: 'plan_id', refT: 'project_plans', refC: 'id', name: 'fk_plp_plan' },
      { t: 'project_plan_projects', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_plp_project' },
      { t: 'project_priority_scores', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_scores_project' },
      { t: 'project_priority_scores', c: 'criterion_id', refT: 'project_priority_criteria', refC: 'id', name: 'fk_scores_criterion' },
      { t: 'project_priority_results', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_results_project' },
      { t: 'project_financial_programs', c: 'plan_id', refT: 'project_plans', refC: 'id', name: 'fk_finprog_plan' },
      { t: 'project_financial_programs', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_finprog_project' },
      { t: 'project_dependencies', c: 'predecessor_project_id', refT: 'projects', refC: 'id', name: 'fk_dep_pred_project' },
      { t: 'project_dependencies', c: 'successor_project_id', refT: 'projects', refC: 'id', name: 'fk_dep_succ_project' },
      { t: 'project_schedules', c: 'project_id', refT: 'projects', refC: 'id', name: 'fk_schedules_project' }
    ];

    for (const ifk of internalFKs) {
      console.log(`Testing FK: ${ifk.t}.${ifk.c} -> ${ifk.refT}.${ifk.refC}...`);
      await client.query(`
        ALTER TABLE public.${ifk.t}
        ADD CONSTRAINT ${ifk.name}
        FOREIGN KEY (${ifk.c}) REFERENCES public.${ifk.refT}(${ifk.refC}) ON DELETE CASCADE
      `);
      console.log(`  ✅ SUCCESS: ${ifk.name} created without error.`);
    }

    // Force rollback so no schema change is made in preflight
    throw new Error('PREFLIGHT_ROLLBACK_INTENTIONAL');
  }).catch(err => {
    if (err.message === 'PREFLIGHT_ROLLBACK_INTENTIONAL') {
      console.log('\n✅ PREFLIGHT COMPLETE: All 18 Foreign Keys can be created cleanly in PostgreSQL with zero errors!');
    } else {
      console.error('\n❌ PREFLIGHT FAILED:', err);
      process.exit(1);
    }
  });

  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
  process.exit(0);
}

preflight();

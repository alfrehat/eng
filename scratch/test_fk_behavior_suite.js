const { dbQuery, withTransaction, closeDatabase } = require('../utils/database');

async function runFkBehaviorSuite() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING PHYSICAL FK BEHAVIOR: NEGATIVE, CASCADE & SET NULL');
  console.log('═══════════════════════════════════════════════════════════════');

  const NON_EXISTENT_ID = 'PRJ-NONEXISTENT-9999';
  const NON_EXISTENT_CRIT = 'CRIT-NONEXISTENT-9999';
  const NON_EXISTENT_PORT = 'PORT-NONEXISTENT-9999';
  const NON_EXISTENT_PLAN = 'PLAN-NONEXISTENT-9999';

  // =========================================================================
  // REQUIREMENT 8: NEGATIVE INTEGRITY TESTS (Inside Transaction -> Rollback)
  // =========================================================================
  console.log('\n--- PART 1: Negative Integrity Tests (Foreign Key Rejection) ---');

  const negativeCases = [
    {
      name: 'Milestone with non-existent project_id',
      sql: 'INSERT INTO public.project_milestones (id, project_id, name, status) VALUES ($1, $2, $3, $4)',
      params: ['MLS-TEST-001', NON_EXISTENT_ID, 'Test Milestone', 'PENDING'],
      expectedConstraint: 'fk_project_milestones_project'
    },
    {
      name: 'Risk with non-existent project_id',
      sql: 'INSERT INTO public.project_risks (id, project_id, description, severity, probability) VALUES ($1, $2, $3, $4, $5)',
      params: ['RSK-TEST-001', NON_EXISTENT_ID, 'Test Risk', 'HIGH', 'HIGH'],
      expectedConstraint: 'fk_project_risks_project'
    },
    {
      name: 'Progress Log with non-existent project_id',
      sql: 'INSERT INTO public.project_progress_logs (id, project_id, physical_progress, financial_progress) VALUES ($1, $2, $3, $4)',
      params: ['PRG-TEST-001', NON_EXISTENT_ID, 10, 10],
      expectedConstraint: 'fk_project_progress_logs_project'
    },
    {
      name: 'Portfolio Project with non-existent project_id',
      sql: 'INSERT INTO public.project_portfolio_projects (id, portfolio_id, project_id) VALUES ($1, $2, $3)',
      params: ['PPP-TEST-001', 'PORT-2026-0001', NON_EXISTENT_ID],
      expectedConstraint: 'fk_project_portfolio_projects_project'
    },
    {
      name: 'Portfolio Project with non-existent portfolio_id',
      sql: 'INSERT INTO public.project_portfolio_projects (id, portfolio_id, project_id) VALUES ($1, $2, $3)',
      params: ['PPP-TEST-002', NON_EXISTENT_PORT, 'PRJ-2026-0001'],
      expectedConstraint: 'fk_project_portfolio_projects_portfolio'
    },
    {
      name: 'Plan Project with non-existent project_id',
      sql: 'INSERT INTO public.project_plan_projects (id, plan_id, project_id) VALUES ($1, $2, $3)',
      params: ['PLP-TEST-001', 'PLAN-2026-0001', NON_EXISTENT_ID],
      expectedConstraint: 'fk_project_plan_projects_project'
    },
    {
      name: 'Plan Project with non-existent plan_id',
      sql: 'INSERT INTO public.project_plan_projects (id, plan_id, project_id) VALUES ($1, $2, $3)',
      params: ['PLP-TEST-002', NON_EXISTENT_PLAN, 'PRJ-2026-0001'],
      expectedConstraint: 'fk_project_plan_projects_plan'
    },
    {
      name: 'Priority Score with non-existent project_id',
      sql: 'INSERT INTO public.project_priority_scores (id, project_id, criterion_id, score) VALUES ($1, $2, $3, $4)',
      params: ['SCR-TEST-001', NON_EXISTENT_ID, 'CRIT-001', 5],
      expectedConstraint: 'fk_project_priority_scores_project'
    },
    {
      name: 'Priority Score with non-existent criterion_id',
      sql: 'INSERT INTO public.project_priority_scores (id, project_id, criterion_id, score) VALUES ($1, $2, $3, $4)',
      params: ['SCR-TEST-002', 'PRJ-2026-0001', NON_EXISTENT_CRIT, 5],
      expectedConstraint: 'fk_project_priority_scores_criterion'
    },
    {
      name: 'Dependency with non-existent predecessor_project_id',
      sql: 'INSERT INTO public.project_dependencies (id, predecessor_project_id, successor_project_id, dependency_type) VALUES ($1, $2, $3, $4)',
      params: ['DEP-TEST-001', NON_EXISTENT_ID, 'PRJ-2026-0001', 'FS'],
      expectedConstraint: 'fk_project_dependencies_predecessor'
    },
    {
      name: 'Dependency with non-existent successor_project_id',
      sql: 'INSERT INTO public.project_dependencies (id, predecessor_project_id, successor_project_id, dependency_type) VALUES ($1, $2, $3, $4)',
      params: ['DEP-TEST-002', 'PRJ-2026-0001', NON_EXISTENT_ID, 'FS'],
      expectedConstraint: 'fk_project_dependencies_successor'
    },
    {
      name: 'Schedule with non-existent project_id',
      sql: 'INSERT INTO public.project_schedules (id, project_id, planned_start_date, planned_end_date, duration_days) VALUES ($1, $2, $3, $4, $5)',
      params: ['SCH-TEST-001', NON_EXISTENT_ID, '2026-01-01', '2026-01-10', 10],
      expectedConstraint: 'fk_project_schedules_project'
    }
  ];

  for (const tc of negativeCases) {
    let rejected = false;
    let errorDetail = '';
    try {
      await withTransaction(async (client) => {
        await client.query(tc.sql, tc.params);
      });
    } catch (err) {
      if (err.code === '23503') { // foreign_key_violation
        rejected = true;
        errorDetail = `violates foreign key constraint [${err.constraint}]`;
      } else {
        errorDetail = `unexpected error: ${err.message} (code: ${err.code})`;
      }
    }

    if (rejected) {
      console.log(`  ✅ PASS (Correctly Rejected by PostgreSQL): ${tc.name} -> ${errorDetail}`);
    } else {
      throw new Error(`❌ FAIL: Expected FK rejection for ${tc.name}, but it was: ${errorDetail}`);
    }
  }

  // =========================================================================
  // REQUIREMENT 9: CASCADE DELETION TEST (Inside Transaction -> Rollback)
  // =========================================================================
  console.log('\n--- PART 2: Cascade Deletion Test ---');
  await withTransaction(async (client) => {
    const testProjId = 'PRJ-CASCADE-TEMP-999';
    console.log(`Creating temporary project: ${testProjId}...`);
    await client.query(`
      INSERT INTO public.projects (id, project_number, project_name, status, budget_amount)
      VALUES ($1, $1, 'مشروع اختبار الحذف التعاقبي', 'PLANNED', 50000)
    `, [testProjId]);

    // Add milestone
    await client.query(`
      INSERT INTO public.project_milestones (id, project_id, name, status)
      VALUES ('MLS-CASCADE-999', $1, 'معلم اختباري', 'PENDING')
    `, [testProjId]);

    // Add risk
    await client.query(`
      INSERT INTO public.project_risks (id, project_id, description, severity, probability)
      VALUES ('RSK-CASCADE-999', $1, 'خطر اختباري', 'LOW', 'LOW')
    `, [testProjId]);

    // Add progress log
    await client.query(`
      INSERT INTO public.project_progress_logs (id, project_id, physical_progress, financial_progress)
      VALUES ('PRG-CASCADE-999', $1, 25, 20)
    `, [testProjId]);

    // Add schedule
    await client.query(`
      INSERT INTO public.project_schedules (id, project_id, planned_start_date, planned_end_date, duration_days)
      VALUES ('SCH-CASCADE-999', $1, '2026-06-01', '2026-06-10', 10)
    `, [testProjId]);

    // Verify children exist
    const mCheck = await client.query('SELECT COUNT(*) FROM public.project_milestones WHERE project_id = $1', [testProjId]);
    const rCheck = await client.query('SELECT COUNT(*) FROM public.project_risks WHERE project_id = $1', [testProjId]);
    const pCheck = await client.query('SELECT COUNT(*) FROM public.project_progress_logs WHERE project_id = $1', [testProjId]);
    const sCheck = await client.query('SELECT COUNT(*) FROM public.project_schedules WHERE project_id = $1', [testProjId]);

    if (mCheck.rows[0].count !== '1' || rCheck.rows[0].count !== '1' || pCheck.rows[0].count !== '1' || sCheck.rows[0].count !== '1') {
      throw new Error('Failed to insert test children for CASCADE verification');
    }
    console.log('  Child records created: 1 milestone, 1 risk, 1 progress log, 1 schedule.');

    // Delete project directly from PostgreSQL
    console.log('Deleting project row directly to test PostgreSQL ON DELETE CASCADE...');
    await client.query('DELETE FROM public.projects WHERE id = $1', [testProjId]);

    // Verify children are automatically deleted by PostgreSQL CASCADE
    const mAfter = await client.query('SELECT COUNT(*) FROM public.project_milestones WHERE project_id = $1', [testProjId]);
    const rAfter = await client.query('SELECT COUNT(*) FROM public.project_risks WHERE project_id = $1', [testProjId]);
    const pAfter = await client.query('SELECT COUNT(*) FROM public.project_progress_logs WHERE project_id = $1', [testProjId]);
    const sAfter = await client.query('SELECT COUNT(*) FROM public.project_schedules WHERE project_id = $1', [testProjId]);

    if (mAfter.rows[0].count === '0' && rAfter.rows[0].count === '0' && pAfter.rows[0].count === '0' && sAfter.rows[0].count === '0') {
      console.log('  ✅ PASS: PostgreSQL ON DELETE CASCADE automatically cleaned up all child records without manual intervention!');
    } else {
      throw new Error('❌ FAIL: Children were not cascaded by PostgreSQL!');
    }

    // Force rollback of test data
    throw new Error('CASCADE_TEST_ROLLBACK_INTENDED');
  }).catch(err => {
    if (err.message !== 'CASCADE_TEST_ROLLBACK_INTENDED') {
      throw err;
    }
  });

  // =========================================================================
  // REQUIREMENT 10: SET NULL TEST FOR EXTERNAL FKS (Inside Transaction -> Rollback)
  // =========================================================================
  console.log('\n--- PART 3: SET NULL Test for External Relationships ---');
  await withTransaction(async (client) => {
    const testProjId = 'PRJ-SETNULL-TEMP-999';
    const tempTenderId = 'TEN-TEMP-999';
    const tempContractId = 'CNT-TEMP-999';
    const tempBudgetLineId = 'BL-TEMP-999';

    // 1. Create temporary tender, contract, budget line
    await client.query(`
      INSERT INTO public.tenders (id, name, status, budget)
      VALUES ($1, 'عطاء اختباري لـ SET NULL', 'DRAFT', 10000)
    `, [tempTenderId]);

    await client.query(`
      INSERT INTO public.contracts (id, contract_number, title, total_value, status)
      VALUES ($1, $1, 'عقد اختباري لـ SET NULL', 10000, 'ACTIVE')
    `, [tempContractId]);

    await client.query(`
      INSERT INTO public.directorate_budget_lines (id, year, chapter_name, line_name, allocated_amount)
      VALUES ($1, '2026', 'فصل النفقات الرأسمالية', 'بند موازنة اختباري لـ SET NULL', 10000)
    `, [tempBudgetLineId]);

    // 2. Create project referencing all three
    await client.query(`
      INSERT INTO public.projects (id, project_number, project_name, status, tender_id, contract_id, budget_line_id)
      VALUES ($1, $1, 'مشروع اختبار SET NULL', 'PLANNED', $2, $3, $4)
    `, [testProjId, tempTenderId, tempContractId, tempBudgetLineId]);

    // Verify initial values
    const beforeRow = await client.query('SELECT tender_id, contract_id, budget_line_id FROM public.projects WHERE id = $1', [testProjId]);
    if (beforeRow.rows[0].tender_id !== tempTenderId || beforeRow.rows[0].contract_id !== tempContractId || beforeRow.rows[0].budget_line_id !== tempBudgetLineId) {
      throw new Error('Failed to reference external targets in test project');
    }
    console.log('  Initial references linked successfully.');

    // 3. Delete Tender -> Check project.tender_id becomes NULL
    console.log('Deleting target Tender...');
    await client.query('DELETE FROM public.tenders WHERE id = $1', [tempTenderId]);
    const afterTender = await client.query('SELECT tender_id FROM public.projects WHERE id = $1', [testProjId]);
    if (afterTender.rows[0].tender_id === null) {
      console.log('  ✅ PASS: projects.tender_id became NULL on tender deletion.');
    } else {
      throw new Error('❌ FAIL: projects.tender_id was NOT set to NULL!');
    }

    // 4. Delete Contract -> Check project.contract_id becomes NULL
    console.log('Deleting target Contract...');
    await client.query('DELETE FROM public.contracts WHERE id = $1', [tempContractId]);
    const afterContract = await client.query('SELECT contract_id FROM public.projects WHERE id = $1', [testProjId]);
    if (afterContract.rows[0].contract_id === null) {
      console.log('  ✅ PASS: projects.contract_id became NULL on contract deletion.');
    } else {
      throw new Error('❌ FAIL: projects.contract_id was NOT set to NULL!');
    }

    // 5. Delete Budget Line -> Check project.budget_line_id becomes NULL
    console.log('Deleting target Budget Line...');
    await client.query('DELETE FROM public.directorate_budget_lines WHERE id = $1', [tempBudgetLineId]);
    const afterBudget = await client.query('SELECT budget_line_id FROM public.projects WHERE id = $1', [testProjId]);
    if (afterBudget.rows[0].budget_line_id === null) {
      console.log('  ✅ PASS: projects.budget_line_id became NULL on budget line deletion.');
    } else {
      throw new Error('❌ FAIL: projects.budget_line_id was NOT set to NULL!');
    }

    // Force rollback of test data
    throw new Error('SET_NULL_TEST_ROLLBACK_INTENDED');
  }).catch(err => {
    if (err.message !== 'SET_NULL_TEST_ROLLBACK_INTENDED') {
      throw err;
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎯 ALL FK BEHAVIOR TESTS PASSED: NEGATIVE, CASCADE & SET NULL!');
  console.log('═══════════════════════════════════════════════════════════════');

  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
}

runFkBehaviorSuite().catch(async (err) => {
  console.error('\n❌ FK BEHAVIOR TEST SUITE FAILED:', err);
  if (typeof closeDatabase === 'function') {
    await closeDatabase();
  }
  process.exit(1);
});

const { withTransaction, dbGet, dbRun, dbQuery } = require('../utils/database');
const assert = require('assert');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TRANSACTION ROLLBACK & ACID ATOMICITY FORENSIC PROOF');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const testProjId = 'PRJ-TEST-ROLLBACK-999';
  const testMlsId = 'MLS-TEST-ROLLBACK-999';

  // Ensure clean state
  await dbRun('DELETE FROM public.project_milestones WHERE id = $1', [testMlsId]);
  await dbRun('DELETE FROM public.projects WHERE id = $1', [testProjId]);

  console.log('--- TEST 1: Compound Insert with Transaction Rollback ---');
  let txErrorCaught = false;

  try {
    await withTransaction(async (client) => {
      // Step 1: Insert project inside transaction
      await client.query(`
        INSERT INTO public.projects (id, project_number, project_name, status, created_at)
        VALUES ($1, $2, $3, 'DRAFT', NOW())
      `, [testProjId, 'PRJ-2026-ROLLBACK-001', 'مشروع اختبار التراجع المعاملاتي']);

      // Step 2: Insert milestone inside transaction
      await client.query(`
        INSERT INTO public.project_milestones (id, project_id, name, planned_date)
        VALUES ($1, $2, $3, CURRENT_DATE)
      `, [testMlsId, testProjId, 'مرحلة اختبار']);

      // Step 3: Simulate intentional runtime crash/error
      throw new Error('SIMULATED_TRANSACTION_FAILURE_TRIGGER');
    });
  } catch (err) {
    if (err.message === 'SIMULATED_TRANSACTION_FAILURE_TRIGGER') {
      txErrorCaught = true;
    } else {
      throw err;
    }
  }

  assert(txErrorCaught, 'Transaction error must be caught and propagated');

  // Verify that NEITHER the project nor the milestone exists in PostgreSQL
  const checkProj = await dbGet('SELECT id FROM public.projects WHERE id = $1', [testProjId]);
  const checkMls = await dbGet('SELECT id FROM public.project_milestones WHERE id = $1', [testMlsId]);

  assert(!checkProj, 'Project must NOT exist in PostgreSQL after transaction rollback');
  assert(!checkMls, 'Milestone must NOT exist in PostgreSQL after transaction rollback');

  console.log('✅ PASS: Compound Insert Transaction Rollback successfully verified (0 orphaned rows)');

  console.log('\n--- TEST 2: Compound Deletion with Transaction Rollback ---');
  // First insert a test project and milestone normally
  await dbRun(`
    INSERT INTO public.projects (id, project_number, project_name, status, created_at)
    VALUES ($1, $2, $3, 'DRAFT', NOW())
  `, [testProjId, 'PRJ-2026-ROLLBACK-002', 'مشروع اختبار تراجع الحذف']);

  await dbRun(`
    INSERT INTO public.project_milestones (id, project_id, name, planned_date)
    VALUES ($1, $2, $3, CURRENT_DATE)
  `, [testMlsId, testProjId, 'مرحلة لاختبار الحذف']);

  let deleteRollbackCaught = false;
  try {
    await withTransaction(async (client) => {
      // Step 1: Delete milestone
      await client.query('DELETE FROM public.project_milestones WHERE id = $1', [testMlsId]);
      
      // Step 2: Simulate failure before deleting project
      throw new Error('SIMULATED_DELETE_FAILURE_TRIGGER');
    });
  } catch (err) {
    if (err.message === 'SIMULATED_DELETE_FAILURE_TRIGGER') {
      deleteRollbackCaught = true;
    } else {
      throw err;
    }
  }

  assert(deleteRollbackCaught, 'Delete rollback error caught');

  // Verify milestone was NOT deleted because of rollback
  const checkMlsAfterRollback = await dbGet('SELECT id FROM public.project_milestones WHERE id = $1', [testMlsId]);
  const checkProjAfterRollback = await dbGet('SELECT id FROM public.projects WHERE id = $1', [testProjId]);

  assert(checkMlsAfterRollback, 'Milestone must still exist because delete was rolled back');
  assert(checkProjAfterRollback, 'Project must still exist because delete was rolled back');

  console.log('✅ PASS: Compound Deletion Transaction Rollback successfully verified (All data preserved)');

  // Clean up
  await dbRun('DELETE FROM public.project_milestones WHERE id = $1', [testMlsId]);
  await dbRun('DELETE FROM public.projects WHERE id = $1', [testProjId]);
  console.log('\nClean up completed. Atomicity proof 100% successful.');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal in atomicity proof:', err);
  process.exit(1);
});

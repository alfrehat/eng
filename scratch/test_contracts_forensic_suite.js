/**
 * scratch/test_contracts_forensic_suite.js
 * Comprehensive Forensic Test Suite for Contracts Unit
 * Kafranjah Engineering Services Directorate System
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const { initDatabase, isPostgresActive, getPool, dbQuery, dbGet, dbRun, withTransaction, memDb } = require('../utils/database');
const contractsEngineService = require('../services/contractsEngineService');
const numberingEngine = require('../services/numberingEngine');
const contractManagementRouter = require('../Contracts/API/contractManagementEngine');

let testPassed = 0;
let testFailed = 0;

async function runTest(name, fn) {
  try {
    process.stdout.write(`🧪 [TEST] ${name} ... `);
    await fn();
    console.log('✅ PASSED');
    testPassed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err.stack);
    testFailed++;
  }
}

async function main() {
  const pool = initDatabase();
  if (pool) {
    try {
      await pool.query('SELECT NOW()');
    } catch (e) {
      console.warn('PostgreSQL test connection note:', e.message);
    }
  }
  // Allow any pending async flags to settle
  await new Promise(r => setTimeout(r, 100));

  console.log('================================================================');
  console.log('🚀 STARTING CONTRACTS FORENSIC VERIFICATION SUITE');
  console.log(`📡 Database Mode: ${isPostgresActive() ? 'PostgreSQL Active (Live)' : 'Memory DB Active'}`);
  console.log('================================================================\n');

  let testContractId = null;

  // -------------------------------------------------------------
  // TEST 1: Schema & Source of Truth Architecture
  // -------------------------------------------------------------
  await runTest('1. Schema & Source of Truth (public.contracts is canonical table, construction_contracts is VIEW)', async () => {
    if (isPostgresActive()) {
      const cTable = await dbGet("SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contracts'");
      assert.strictEqual(cTable?.table_type, 'BASE TABLE', 'public.contracts must be a BASE TABLE');

      const ccView = await dbGet("SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'construction_contracts'");
      assert.strictEqual(ccView?.table_type, 'VIEW', 'public.construction_contracts must be a VIEW');

      const voTable = await dbGet("SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_variation_orders'");
      assert.strictEqual(voTable?.table_type, 'BASE TABLE', 'public.contract_variation_orders must be a BASE TABLE');

      const bgTable = await dbGet("SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_guarantees'");
      assert.strictEqual(bgTable?.table_type, 'BASE TABLE', 'public.bank_guarantees must be a BASE TABLE');

      const clTable = await dbGet("SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_clauses'");
      assert.strictEqual(clTable?.table_type, 'BASE TABLE', 'public.contract_clauses must be a BASE TABLE');
    }
  });

  // -------------------------------------------------------------
  // TEST 2: Numbering Engine Integration
  // -------------------------------------------------------------
  await runTest('2. Numbering Engine generates sequential atomic contract and VO IDs', async () => {
    const nextContractId = await numberingEngine.generateNextId('contracts', { prefix: 'CNT' });
    assert(nextContractId.startsWith('CNT-'), `Expected prefix CNT-, got: ${nextContractId}`);

    const nextVOId = await numberingEngine.generateNextId('variation_orders', { prefix: 'VO' });
    assert(nextVOId.startsWith('VO-'), `Expected prefix VO-, got: ${nextVOId}`);
  });

  // -------------------------------------------------------------
  // TEST 3: Contract Creation with Initial Guarantees & Clauses
  // -------------------------------------------------------------
  await runTest('3. Contract Creation via contractsEngineService (Transactional Atomic)', async () => {
    const created = await contractsEngineService.createContract({
      title: 'مشروع صيانة وتأهيل شوارع كفرنجة الحزمة 4',
      contractor_name: 'شركة الفريحات للتعهدات الإنشائية',
      total_value: 85000,
      execution_period_days: 90,
      department: 'مديرية الأشغال والخدمات الهندسية',
      supervising_engineer: 'م. أحمد الخشمان',
      bank_name: 'البنك العربي الإسلامي الدولي',
      guarantee_number: 'BG-ARB-2026-99',
      guarantee_value: 8500,
      guarantee_expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      clauses: [
        { clause_number: 1, title: 'نطاق الأعمال والمواصفات الفنية', content: 'يلتزم المقاول بالمخططات المعتمدة' },
        { clause_number: 2, title: 'مدة الإنجاز وغرامات التأخير', content: 'مدة العمل 90 يوماً وغرامة التأخير 100 دينار يومياً' }
      ]
    }, { id: 'TEST_USER', username: 'auditor' });

    assert(created, 'Contract must be created and returned');
    assert(created.id, 'Contract must have an ID');
    assert.strictEqual(created.contractor_name, 'شركة الفريحات للتعهدات الإنشائية');
    assert.strictEqual(created.total_value, 85000);
    testContractId = created.id;

    // Verify row in public.contracts
    if (isPostgresActive()) {
      const dbRow = await dbGet('SELECT * FROM public.contracts WHERE id = $1', [testContractId]);
      assert(dbRow, 'Record must exist in public.contracts');
      assert.strictEqual(parseFloat(dbRow.total_value), 85000);

      // Verify row is queryable via construction_contracts view
      const viewRow = await dbGet('SELECT * FROM public.construction_contracts WHERE id = $1', [testContractId]);
      assert(viewRow, 'Record must be visible via public.construction_contracts VIEW');
      assert.strictEqual(viewRow.id, testContractId);
    }
  });

  // -------------------------------------------------------------
  // TEST 4: Contract Retrieval & Filtering
  // -------------------------------------------------------------
  await runTest('4. Contract Retrieval & Complex Filtering', async () => {
    const contract = await contractsEngineService.getContractById(testContractId);
    assert(contract, 'Must retrieve contract by ID');
    assert.strictEqual(contract.id, testContractId);
    assert(contract.bankGuarantees && contract.bankGuarantees.length >= 1, 'Initial guarantee must be loaded');

    // Filter by search
    const searchRes = await contractsEngineService.getContracts({ search: 'الفريحات' });
    assert(searchRes.length >= 1, 'Search by contractor name must return results');
    assert(searchRes.some(c => c.id === testContractId));

    // Filter by min value
    const valRes = await contractsEngineService.getContracts({ minVal: 80000 });
    assert(valRes.some(c => c.id === testContractId));

    // Filter by non-existent status
    const emptyRes = await contractsEngineService.getContracts({ status: 'NON_EXISTENT_STATUS_XYZ' });
    assert(Array.isArray(emptyRes), 'Empty filter must return array');
    assert.strictEqual(emptyRes.length, 0, 'Empty filter must return empty array, not null or error');
  });

  // -------------------------------------------------------------
  // TEST 5: Variation Orders & 25% Legal Limit Enforcement
  // -------------------------------------------------------------
  await runTest('5. Variation Orders with 25% Legal Cap Enforcement & Value Sync', async () => {
    // Contract base value = 85,000. 25% limit = 21,250.
    // 5.1 Add VO within limit (10,000 = 11.76%)
    const vo1 = await contractsEngineService.addVariationOrder(testContractId, {
      title: 'أمر تغييري رقم 1 - زيادة سماكة الإسفلت',
      amount: 10000,
      extensionDays: 15,
      description: 'بناء على تقرير التربة والفحوصات المخبرية'
    }, { username: 'engineer' });

    assert(vo1, 'Must return updated contract');
    assert.strictEqual(vo1.finalContractValue, 95000, 'Contract value must increase to 95,000');

    const vos = await contractsEngineService.getVariationOrders(testContractId);
    assert.strictEqual(vos.length, 1);
    assert.strictEqual(vos[0].isExceedingLimit, false, '10,000 is within 25%');

    // 5.2 Add VO exceeding limit (additional 15,000 -> cumulative 25,000 = 29.41% > 25%)
    const vo2 = await contractsEngineService.addVariationOrder(testContractId, {
      title: 'أمر تغييري رقم 2 - أعمال تصريف مياه إضافية',
      amount: 15000,
      extensionDays: 20,
      description: 'توسيع نطاق العبارات الصندوقية'
    }, { username: 'director' });

    const vos2 = await contractsEngineService.getVariationOrders(testContractId);
    assert.strictEqual(vos2.length, 2);
    const exceedingVO = vos2.find(v => v.title.includes('رقم 2'));
    assert(exceedingVO, 'Second VO must exist');
    assert.strictEqual(exceedingVO.isExceedingLimit, true, 'Second VO must exceed 25% legal limit');
    assert.strictEqual(exceedingVO.status, 'REQUIRES_MINISTRY_APPROVAL');

    // 5.3 Delete VO2 and check restoration
    await contractsEngineService.deleteVariationOrder(testContractId, exceedingVO.id, { username: 'auditor' });
    const contractAfterDelete = await contractsEngineService.getContractById(testContractId);
    assert.strictEqual(contractAfterDelete.finalContractValue, 95000, 'Value must restore to 95,000 after VO deletion');
  });

  // -------------------------------------------------------------
  // TEST 6: Bank Guarantees Lifecycle & Smart Alerts
  // -------------------------------------------------------------
  await runTest('6. Bank Guarantees Management, Lifecycle & Expiry Alerts', async () => {
    // Add additional maintenance guarantee
    await contractsEngineService.addBankGuarantee(testContractId, {
      guarantee_type: 'MAINTENANCE_BOND',
      guarantee_number: 'BG-MAINT-2026-01',
      bank_name: 'بنك الإسكان للتجارة والتمويل',
      amount: 4250,
      expiry_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0], // expires in 20 days -> CRITICAL
      purpose: 'كفالة صيانة'
    }, { username: 'accountant' });

    const bgs = await contractsEngineService.getBankGuarantees(testContractId);
    assert.strictEqual(bgs.length, 2, 'Must have 2 bank guarantees');

    // Check alerts
    const alerts = await contractsEngineService.getGuaranteesAlerts();
    assert(alerts, 'Alerts object must be returned');
    assert(Array.isArray(alerts.within_30_days), 'Must have within_30_days array');
    const criticalAlert = alerts.within_30_days.find(g => g.contractId === testContractId && g.guaranteeNumber === 'BG-MAINT-2026-01');
    assert(criticalAlert, 'Maintenance guarantee expiring in 20 days must appear in within_30_days');

    // Test Action: Release guarantee
    const bgToRelease = bgs.find(g => g.guarantee_number === 'BG-MAINT-2026-01');
    const releaseRes = await contractsEngineService.updateBankGuaranteeAction(bgToRelease.id, 'release', {}, { username: 'director' });
    assert(releaseRes.success, 'Release action must succeed');

    if (isPostgresActive()) {
      const updatedBg = await dbGet('SELECT status FROM public.bank_guarantees WHERE id = $1', [bgToRelease.id]);
      assert.strictEqual(updatedBg.status, 'RELEASED', 'Status must be updated to RELEASED in DB');
    }
  });

  // -------------------------------------------------------------
  // TEST 7: Contract Clauses CRUD & Reordering
  // -------------------------------------------------------------
  await runTest('7. Contract Clauses CRUD, Duplicate & Reorder Operations', async () => {
    const clauses = await contractsEngineService.getClauses(testContractId);
    assert(clauses.length >= 2, 'Initial clauses must exist');

    // Add Clause
    const newClause = await contractsEngineService.addClause(testContractId, {
      clause_number: 3,
      title: 'إجراءات استلام المشروع الابتدائي',
      content: 'يتم تشكيل لجنة استلام هندسية متخصصة',
      display_order: 3
    }, { username: 'legal' });
    assert(newClause.id, 'New clause must have an ID');

    // Duplicate Clause
    const dupClause = await contractsEngineService.duplicateClause(testContractId, newClause.id, { username: 'legal' });
    assert(dupClause.id, 'Duplicated clause must have new ID');
    assert(dupClause.title.includes('نسخة مكررة'));

    // Reorder Clauses
    const reorderRes = await contractsEngineService.reorderClauses(testContractId, [dupClause.id, newClause.id], { username: 'legal' });
    assert(reorderRes.success, 'Reorder must succeed');

    // Delete Clause
    const delRes = await contractsEngineService.deleteClause(testContractId, dupClause.id, { username: 'legal' });
    assert(delRes.success, 'Delete clause must succeed');
  });

  // -------------------------------------------------------------
  // TEST 8: Workflow Transition & SHA-256 Digital Signature
  // -------------------------------------------------------------
  await runTest('8. Workflow Stage Transitions & Cryptographic Digital Signatures', async () => {
    // 8.1 Workflow Transition
    const transitioned = await contractsEngineService.transitionWorkflow(testContractId, {
      status: 'REVIEW',
      stage: 'LEGAL_AUDIT',
      notes: 'تم التدقيق القانوني لكافة البنود'
    }, { username: 'legal_advisor' });
    assert.strictEqual(transitioned.status, 'REVIEW');

    // 8.2 Digital Signature
    const signed = await contractsEngineService.signContract(testContractId, {
      signer_role: 'FIRST_PARTY',
      signer_name: 'رئيس بلدية كفرنجة الجديدة',
      ip: '192.168.1.100'
    }, { username: 'mayor' });

    assert.strictEqual(signed.status, 'ELECTRONICALLY_SIGNED');
    if (isPostgresActive()) {
      const dbContract = await dbGet('SELECT sha256_hash, digital_signatures, status FROM public.contracts WHERE id = $1', [testContractId]);
      assert(dbContract.sha256_hash, 'Contract must have SHA-256 cryptographic hash');
      assert.strictEqual(dbContract.sha256_hash.length, 64, 'SHA-256 hash must be 64 characters');
      assert.strictEqual(dbContract.status, 'ELECTRONICALLY_SIGNED');
    }
  });

  // -------------------------------------------------------------
  // TEST 9: Transaction Rollback Integrity
  // -------------------------------------------------------------
  await runTest('9. Transaction Rollback Integrity (No Orphaned Records on Failure)', async () => {
    if (!isPostgresActive()) return;

    const fakeId = 'CNT-FAIL-TEST-' + Date.now();
    let errorCaught = false;

    try {
      await withTransaction(async (client) => {
        await client.run(`
          INSERT INTO public.contracts (id, title, total_value, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [fakeId, 'عقد اختبار الفشل', 50000, 'DRAFT']);

        // Force intentional syntax/type error
        await client.run('INSERT INTO public.non_existent_table_xyz VALUES (1)');
      });
    } catch (e) {
      errorCaught = true;
    }

    assert(errorCaught, 'Expected transaction error to be thrown');
    const checkRow = await dbGet('SELECT id FROM public.contracts WHERE id = $1', [fakeId]);
    assert.strictEqual(checkRow, null, 'Row must have been rolled back; no orphaned contract');
  });

  // -------------------------------------------------------------
  // TEST 10: PostgreSQL Failure & Empty Result Semantics
  // -------------------------------------------------------------
  await runTest('10. Failure & Empty Query Semantics (No False Success)', async () => {
    // Non-existent contract returns null, not empty success or error
    const nonExistent = await contractsEngineService.getContractById('CNT-NON-EXISTENT-404');
    assert.strictEqual(nonExistent, null, 'Non-existent contract must return null');

    // Non-existent search query returns empty array
    const emptySearch = await contractsEngineService.getContracts({ search: 'DEFINITELY_NOT_HERE_XYZ_999' });
    assert(Array.isArray(emptySearch) && emptySearch.length === 0, 'Empty search must return empty array');

    // Invalid input throws descriptive error
    let invalidCaught = false;
    try {
      await contractsEngineService.createContract({
        title: 'عقد بدون مقاول وبدون قيمة',
        contractor_name: '',
        total_value: -100
      });
    } catch (e) {
      invalidCaught = true;
    }
    assert(invalidCaught, 'Invalid contract data must throw validation error');
  });

  // -------------------------------------------------------------
  // TEST 11: Cascade Deletion & Cleanup
  // -------------------------------------------------------------
  await runTest('11. Cascade Deletion of Contract and Children', async () => {
    if (!testContractId) return;

    const delRes = await contractsEngineService.deleteContract(testContractId, { username: 'admin' });
    assert(delRes.success, 'Contract deletion must succeed');

    const checkC = await contractsEngineService.getContractById(testContractId);
    assert.strictEqual(checkC, null, 'Contract must no longer exist');

    if (isPostgresActive()) {
      const checkClauses = await dbQuery('SELECT id FROM public.contract_clauses WHERE contract_id = $1', [testContractId]);
      assert.strictEqual(checkClauses.length, 0, 'All clauses must be cascaded and deleted');

      const checkBgs = await dbQuery('SELECT id FROM public.bank_guarantees WHERE contract_id = $1', [testContractId]);
      assert.strictEqual(checkBgs.length, 0, 'All bank guarantees must be cascaded and deleted');

      const checkVos = await dbQuery('SELECT id FROM public.contract_variation_orders WHERE contract_id = $1', [testContractId]);
      assert.strictEqual(checkVos.length, 0, 'All variation orders must be cascaded and deleted');
    }
  });

  // -------------------------------------------------------------
  // TEST 12: Health Check Diagnostics
  // -------------------------------------------------------------
  await runTest('12. Contracts Engine Health Check & Operational Metrics', async () => {
    const health = await contractsEngineService.healthCheck();
    assert(health, 'Health check must return report');
    assert.strictEqual(health.healthy, true, 'Health check must be healthy');
    assert.strictEqual(health.status, 'READY');
    assert.strictEqual(health.engineId, 'CONTRACTS_ENGINE');
  });

  console.log('\n================================================================');
  console.log(`📊 CONTRACTS FORENSIC SUITE FINISHED: ${testPassed} Passed, ${testFailed} Failed`);
  console.log('================================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal in test suite:', err);
  process.exit(1);
});

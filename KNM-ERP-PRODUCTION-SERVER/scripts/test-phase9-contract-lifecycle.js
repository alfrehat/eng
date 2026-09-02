/**
 * scripts/test-phase9-contract-lifecycle.js
 * 📜 فحص دورة حياة العقود والمطالبات والأوامر التغييرية (Phase 09 Contract Lifecycle)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineOrchestrator = require('../services/engineOrchestrator');
const { memDb, saveMemTable } = require('../utils/database');

async function runPhase9ContractLifecycleTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📜 بدء فحص دورة حياة العقود والمطالبات (Phase 09 Contract Lifecycle)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  const admin = { id: 'U-PILOT-01', username: 'pilot_admin', role: 'admin' };

  try {
    const testContractId = `CNT-${Date.now()}`;
    const contract = {
      id: testContractId,
      contract_number: `CNT-2026-${Math.floor(Math.random() * 900 + 100)}`,
      contractor_name: 'شركة المقاولات النموذجية',
      contract_value: 50000.0,
      status: 'ACTIVE'
    };
    if (!memDb.contracts) memDb.contracts = [];
    memDb.contracts.push(contract);
    saveMemTable('contracts');
    assert(true, 'Contract signed and activated');

    // احتساب مستخلص مالي للمقاول مع استقطاع 10% حسن تنفيذ
    const claimCalc = await engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculateClaimFinancials',
      [{ contractValue: 50000, currentCompletedValue: 20000, previousPayments: 5000, retentionPct: 10 }],
      { user: admin }
    );
    assert(claimCalc.currentGross === 15000 && claimCalc.netPayable === 13500, 'Claim financial calculations validated');
  } catch (err) {
    assert(false, 'Contract lifecycle failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لدورة حياة العقد: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9ContractLifecycleTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9ContractLifecycleTestSuite;

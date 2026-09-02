/**
 * scripts/test-phase10-concurrency.js
 * 👥 فحص التزامن ومنع تضارب التحديثات (Phase 10 Concurrency & Safety)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineOrchestrator = require('../services/engineOrchestrator');
const { memDb } = require('../utils/database');

async function runPhase10ConcurrencyTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('👥 بدء فحص التزامن وتضارب التحديثات المتزامنة (Phase 10 Concurrency)');
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

  const userA = { id: 'U-PILOT-01', username: 'engineer_a', role: 'engineer' };
  const userB = { id: 'U-PILOT-02', username: 'engineer_b', role: 'engineer' };

  try {
    // 1. فحص التحديث المتزامن لحسابات وقيود المطالبات
    const claimCalcPromiseA = engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculateClaimFinancials',
      [{ contractValue: 100000, currentCompletedValue: 30000, previousPayments: 10000 }],
      { user: userA }
    );
    const claimCalcPromiseB = engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculateClaimFinancials',
      [{ contractValue: 100000, currentCompletedValue: 40000, previousPayments: 30000 }],
      { user: userB }
    );

    const [resA, resB] = await Promise.all([claimCalcPromiseA, claimCalcPromiseB]);
    assert(resA && resA.currentGross === 20000, 'User A concurrent computation isolated');
    assert(resB && resB.currentGross === 10000, 'User B concurrent computation isolated');
    assert(resA.currentGross !== resB.currentGross, 'Zero cross-contamination between concurrent requests');
  } catch (err) {
    assert(false, 'Concurrency test failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص التزامن: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10ConcurrencyTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10ConcurrencyTestSuite;

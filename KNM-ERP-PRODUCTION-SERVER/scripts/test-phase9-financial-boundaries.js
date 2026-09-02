/**
 * scripts/test-phase9-financial-boundaries.js
 * 💰 فحص الحدود المالية والقيود المحاسبية الصارمة (Phase 09 Financial Boundaries)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const businessRulesEngine = require('../services/businessRulesEngine');

async function runPhase9FinancialBoundariesTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('💰 بدء فحص الحدود المالية والقيود المحاسبية (Phase 09 Financial Boundaries)');
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

  try {
    // 1. اختبار القيم الصفرية والسالبة
    const zeroResult = businessRulesEngine.calculateClaimFinancials({
      contractValue: 0,
      currentCompletedValue: -500,
      previousPayments: 0
    });
    assert(zeroResult.currentGross === 0 && zeroResult.netPayable === 0, 'Negative inputs clamped gracefully to zero');

    // 2. اختبار سقف الأوامر التغييرية (حد الـ 25% القانوني)
    const voAllowed = businessRulesEngine.validateVariationOrderLimit({
      contractValue: 100000,
      existingVariationOrdersSum: 15000,
      newVariationOrderAmount: 8000
    });
    assert(voAllowed.isWithinLegalLimit === true, 'Variation order within 25% limit allowed (23%)');

    const voExceeded = businessRulesEngine.validateVariationOrderLimit({
      contractValue: 100000,
      existingVariationOrdersSum: 20000,
      newVariationOrderAmount: 10000
    });
    assert(voExceeded.isWithinLegalLimit === false, 'Variation order exceeding 25% limit rejected (30%)');
  } catch (err) {
    assert(false, 'Financial boundaries failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للحدود المالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9FinancialBoundariesTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9FinancialBoundariesTestSuite;

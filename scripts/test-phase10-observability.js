/**
 * scripts/test-phase10-observability.js
 * 📊 فحص الرصد والمراقبة والمقاييس التشغيلية (Phase 10 Observability Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const observabilityService = require('../services/observabilityService');

async function runPhase10ObservabilityTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 بدء فحص خدمة الرصد والمراقبة التشغيلية (Phase 10 Observability)');
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
    // 1. تسجيل حدث أمني مع تنقية الأسرار
    const secEvt = observabilityService.recordSecurityEvent('LOGIN_ATTEMPT', {
      username: 'inspector_test',
      password: 'PlainSecretPassword123'
    });
    assert(secEvt && secEvt.correlationId, 'Security event registered with correlation ID');

    // 2. تسجيل توقيت عملية ورصد زمن الاستجابة
    observabilityService.recordTiming('CPM_CALCULATION', 45);
    observabilityService.recordTiming('CLAIM_COMPUTATION', 15);
    const summary = observabilityService.getMetricsSummary();
    assert(summary && summary.metricsCount >= 2, 'Operational metrics tracked and aggregated');
    assert(summary.status === 'HEALTHY' && typeof summary.averageLatencyMs === 'number', 'System health & latency summary verified');
  } catch (err) {
    assert(false, 'Observability failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لخدمة الرصد: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10ObservabilityTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10ObservabilityTestSuite;

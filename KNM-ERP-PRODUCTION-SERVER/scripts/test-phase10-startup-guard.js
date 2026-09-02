/**
 * scripts/test-phase10-startup-guard.js
 * 🛡️ فحص حارس بدء التشغيل الإنتاجي (Phase 10 Production Startup Guard Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const productionStartupGuard = require('../services/productionStartupGuard');

async function runPhase10StartupGuardTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ بدء فحص حارس الإقلاع والتحقق الاستباقي (Phase 10 Startup Guard)');
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
    const preflight = await productionStartupGuard.runPreflightChecks();
    assert(preflight && typeof preflight === 'object', 'Preflight check report generated');
    assert(preflight.passed === true, 'All essential system preflight requirements met');
    assert(preflight.checks.length >= 5, 'Comprehensive checklist verified (Config, Storage, Engines, Auth, Database)');
    assert(preflight.criticalFailures.length === 0, 'Zero critical failures detected before go-live');
  } catch (err) {
    assert(false, 'Startup guard failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لحارس الإقلاع: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10StartupGuardTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10StartupGuardTestSuite;

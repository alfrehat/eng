/**
 * scripts/test-phase10-production-closure.js
 * 🏆 الفحص الختامي الشامل لجاهزية الإطلاق الإنتاجي المحكوم (Phase 10 Production Closure)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const productionConfig = require('../config/productionConfig');
const productionStartupGuard = require('../services/productionStartupGuard');
const observabilityService = require('../services/observabilityService');
const engineRegistry = require('../services/engineRegistry');

async function runPhase10ProductionClosureTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏆 بدء الفحص الختامي للتحصين والجاهزية الإنتاجية (Phase 10 Production Closure)');
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
    // 1. فحص الإعدادات الإنتاجية وحجب الأسرار
    const cfg = productionConfig.getSanitizedConfig();
    assert(Boolean(cfg && cfg.appVersion), 'Production configuration verified with versioning');
    assert(cfg.security.jwtSecret === '***REDACTED***' || cfg.security.jwtSecret === null, 'Secrets strictly sanitized and segregated');

    // 2. فحص حارس بدء التشغيل (Startup Guard)
    const preflight = await productionStartupGuard.runPreflightChecks();
    assert(preflight.passed === true, 'Preflight production guard validation passed without critical blockers');

    // 3. فحص تكامل الـ 28 محركاً مؤسسياً
    const engines = engineRegistry.list();
    assert(engines.length === 28, 'All 28 Enterprise Core & Domain Engines online and registered');

    // 4. فحص خدمة الرصد والمراقبة
    const metrics = observabilityService.getMetricsSummary();
    assert(metrics.status === 'HEALTHY', 'Observability and health tracking service operational');
  } catch (err) {
    assert(false, 'Production closure failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الختامي للمرحلة العاشرة: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10ProductionClosureTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10ProductionClosureTestSuite;

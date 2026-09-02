/**
 * scripts/test-phase10-rate-limit.js
 * ⏱️ فحص محدد معدل الطلبات وحماية العمليات الحساسة (Phase 10 Rate Limiting)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const productionConfig = require('../config/productionConfig');

async function runPhase10RateLimitTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('⏱️ بدء فحص محدد معدل الطلبات وحماية الإفراط (Phase 10 Rate Limiting)');
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
    const rateLimitCfg = productionConfig.config.security.rateLimit;
    assert(rateLimitCfg && rateLimitCfg.windowMs > 0, 'Rate limit window configured (15 mins window)', `${rateLimitCfg.windowMs}ms`);
    assert(rateLimitCfg.maxRequests >= 500, 'Standard requests ceiling configured', `${rateLimitCfg.maxRequests} req/window`);
    assert(rateLimitCfg.authMaxRequests <= 50, 'Strict auth/login brute-force ceiling configured', `${rateLimitCfg.authMaxRequests} req/window`);
  } catch (err) {
    assert(false, 'Rate limit failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لمحدد الطلبات: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10RateLimitTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10RateLimitTestSuite;

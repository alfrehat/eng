/**
 * scripts/test-phase10-production-config.js
 * 🏛️ فحص إعدادات الإنتاج المركزية وفصل الأسرار (Phase 10 Production Config Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const productionConfig = require('../config/productionConfig');

async function runPhase10ProductionConfigTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ بدء فحص طبقة الإعدادات الإنتاجية المركزية (Phase 10 Production Config)');
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
    // 1. فحص تحميل الإعدادات الافتراضية والمسارات
    const cfg = productionConfig.config;
    assert(Boolean(cfg && cfg.appVersion), 'Production configuration loaded with valid APP_VERSION', cfg.appVersion);
    assert(Boolean(cfg.storage && cfg.storage.backupPath), 'Storage paths configured and validated');
    assert(Boolean(cfg.security && cfg.security.sessionTimeout > 0), 'Security parameters initialized with secure timeouts');

    // 2. فحص تنقية وحجب الأسرار (Sanitization & Secret Redaction)
    const sanitized = productionConfig.getSanitizedConfig();
    assert(sanitized.security.jwtSecret === '***REDACTED***' || sanitized.security.jwtSecret === null, 'JWT Secret securely redacted in sanitized exports');
    assert(!JSON.stringify(sanitized).includes('Alfrehat@1994'), 'Database password strictly hidden from logs and debug dumps');

    // 3. فحص التحقق الصارم في وضع الإنتاج
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    productionConfig.load();
    const valRes = productionConfig.validate();
    assert(valRes.isValid === false && valRes.errors.length > 0, 'Production validation rejects insecure short secrets');

    // إعادة الضبط
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = 'kfranjah-secure-pki-key-2026';
    productionConfig.load();
  } catch (err) {
    assert(false, 'Production config failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص إعدادات الإنتاج: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10ProductionConfigTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10ProductionConfigTestSuite;

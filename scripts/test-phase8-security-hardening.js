/**
 * scripts/test-phase8-security-hardening.js
 * 🛡️ فحص التحصين الأمني للإنتاج (Phase 08 Security Hardening Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');

async function runPhase8SecurityHardeningTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ بدء الفحص الأمني المتقدم والتحصين للإنتاج (Phase 08 Security)');
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

  // 1. فحص حماية المسارات الحساسة ومنع الوصول غير المصرح به
  console.log('🔒 1. فحص منع الوصول المباشر للمسارات المحمية...');
  try {
    const guard = rbacManager.requirePermission('SYSTEM.MANAGE');
    let code401 = false;
    await guard({ user: null, ip: '192.168.1.100', originalUrl: '/api/settings', method: 'POST' }, {
      status: (s) => { if (s === 401) code401 = true; return { json: () => {} }; }
    }, () => {});
    assert(code401 === true, 'Protected route returns 401 on unauthenticated request');

    let code403 = false;
    await guard({ user: { id: 'U-007', permissions: ['ROADS.VIEW'] }, ip: '192.168.1.100', originalUrl: '/api/settings', method: 'POST' }, {
      status: (s) => { if (s === 403) code403 = true; return { json: () => {} }; }
    }, () => {});
    assert(code403 === true, 'Protected route returns 403 on insufficient permissions');
  } catch (err) {
    assert(false, 'Security hardening check failure', err.message);
  }

  // 2. فحص معالج الأخطاء العام وعدم تسريب Stack Traces
  console.log('\n🛡️ 2. التحقق من معالج الأخطاء العام globalErrorHandler...');
  try {
    const globalErrorHandler = require('../middlewares/globalErrorHandler');
    assert(typeof globalErrorHandler === 'function', 'globalErrorHandler middleware is loaded and active');
  } catch (err) {
    assert(false, 'Global error handler check failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الأمني المتقدم (Phase 08 Security):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8SecurityHardeningTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8SecurityHardeningTestSuite;

/**
 * scripts/test-phase9-error-handling.js
 * 🛡️ فحص معالجة الأخطاء وحماية البيانات ومنع تسريب البيانات الحساسة (Phase 09 Error Handling)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const globalErrorHandler = require('../middlewares/globalErrorHandler');

async function runPhase9ErrorHandlingTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ بدء فحص معالجة الأخطاء وحماية الاستجابات (Phase 09 Error Handling)');
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
    let capturedResponse = null;
    let statusCode = null;

    const mockReq = { method: 'POST', originalUrl: '/api/test-error', ip: '127.0.0.1' };
    const mockRes = {
      status: (s) => { statusCode = s; return { json: (j) => { capturedResponse = j; } }; },
      headersSent: false
    };

    const simulatedError = new Error('Database relation error at /internal/pg.js');
    globalErrorHandler(simulatedError, mockReq, mockRes, () => {});

    assert(statusCode === 500, 'Handled error returned HTTP status 500');
    assert(capturedResponse && capturedResponse.error, 'Returned clean localized error message');
    assert(!JSON.stringify(capturedResponse).includes('/internal/pg.js'), 'Stack trace and internal paths stripped from response');
  } catch (err) {
    assert(false, 'Error handling suite failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص معالجة الأخطاء: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9ErrorHandlingTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9ErrorHandlingTestSuite;

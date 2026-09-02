/**
 * scripts/test-phase10-security-hardening.js
 * 🛡️ فحص التحصين الأمني الشامل ومنع تسريب البيانات (Phase 10 Security Hardening)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');
const globalErrorHandler = require('../middlewares/globalErrorHandler');

async function runPhase10SecurityHardeningTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ بدء فحص التحصين الأمني الشامل والـ RBAC (Phase 10 Security Hardening)');
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
    // 1. فحص منع الوصول غير المصرح به (403 Forbidden)
    const inspectorUser = { id: 'U-004', username: 'inspector', role: 'inspector', permissions: ['ROADS.VIEW'] };
    const canDeleteProjects = rbacManager.hasPermission(inspectorUser, 'PROJECTS.DELETE');
    assert(canDeleteProjects === false, 'Privilege escalation blocked (Inspector cannot delete projects)');

    // 2. فحص التحقق من مدير النظام
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin', permissions: ['*'] };
    const adminCanDelete = rbacManager.hasPermission(adminUser, 'PROJECTS.DELETE');
    assert(adminCanDelete === true, 'Admin verified with super-user permissions');

    // 3. فحص معالجة الأخطاء ومنع تسريب الـ Stack Traces (500 Error Sanitization)
    let errResponse = null;
    let statusCode = null;
    const mockReq = { method: 'POST', originalUrl: '/api/claims', ip: '127.0.0.1' };
    const mockRes = {
      status: (s) => { statusCode = s; return { json: (j) => { errResponse = j; } }; },
      headersSent: false
    };
    const sensitiveError = new Error('FATAL: Database connection timeout at /core/pg_pool.js:124');
    globalErrorHandler(sensitiveError, mockReq, mockRes, () => {});

    assert(statusCode === 500, 'Handled server exception returned HTTP status 500');
    assert(errResponse && !JSON.stringify(errResponse).includes('pg_pool.js'), 'Stack trace and file paths stripped from client response');
  } catch (err) {
    assert(false, 'Security hardening failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للتحصين الأمني: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10SecurityHardeningTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10SecurityHardeningTestSuite;

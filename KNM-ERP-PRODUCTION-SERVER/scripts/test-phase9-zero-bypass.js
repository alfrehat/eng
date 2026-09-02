/**
 * scripts/test-phase9-zero-bypass.js
 * 🛡️ فحص الأمان الصارم ومنع التجاوز المباشر لواجهات الـ APIs (Phase 09 Zero Bypass)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');

async function runPhase9ZeroBypassTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ بدء فحص الأمان الصارم ومنع التجاوز المباشر (Phase 09 Zero Bypass)');
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

  const endpoints = [
    { name: 'Projects Approval', permission: 'PROJECTS.APPROVE' },
    { name: 'Tenders Awarding', permission: 'TENDERS.AWARD' },
    { name: 'Claims Financial Approval', permission: 'CLAIMS.APPROVE' },
    { name: 'Contracts Modification', permission: 'CONTRACTS.EDIT' },
    { name: 'System Settings Alteration', permission: 'SYSTEM.MANAGE' },
    { name: 'RBAC Permissions Editing', permission: 'ROLES.MANAGE' }
  ];

  for (const ep of endpoints) {
    const middleware = rbacManager.requirePermission(ep.permission);

    // 1. فحص طلب بدون توثيق (No Auth -> 401)
    let code401 = false;
    await middleware({ user: null, ip: '127.0.0.1', originalUrl: '/test', method: 'POST' }, {
      status: s => { if (s === 401) code401 = true; return { json: () => {} }; }
    }, () => {});
    assert(code401 === true, `Unauthenticated call to ${ep.name} returns 401`);

    // 2. فحص طلب بصلاحية خاطئة (Wrong Permission -> 403)
    let code403 = false;
    await middleware({ user: { id: 'U-009', permissions: ['ROADS.VIEW'] }, ip: '127.0.0.1', originalUrl: '/test', method: 'POST' }, {
      status: s => { if (s === 403) code403 = true; return { json: () => {} }; }
    }, () => {});
    assert(code403 === true, `Unauthorized call to ${ep.name} returns 403`);

    // 3. فحص طلب بالصلاحية الصحيحة (Valid Permission -> Next)
    let calledNext = false;
    await middleware({ user: { id: 'U-001', role: 'admin', permissions: ['*'] }, ip: '127.0.0.1', originalUrl: '/test', method: 'POST' }, {
      status: () => ({ json: () => {} })
    }, () => { calledNext = true; });
    assert(calledNext === true, `Authorized call to ${ep.name} successfully calls next()`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص منع التجاوز: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9ZeroBypassTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9ZeroBypassTestSuite;

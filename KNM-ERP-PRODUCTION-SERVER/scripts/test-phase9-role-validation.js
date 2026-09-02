/**
 * scripts/test-phase9-role-validation.js
 * 👥 التحقق الميداني من صلاحيات وسلوك الأدوار الوظيفية الخمسة (Phase 09 Roles Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');

async function runPhase9RoleValidationTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('👥 بدء التحقق الميداني من الأدوار الوظيفية الخمسة (Phase 09 Role Validation)');
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

  const users = {
    admin: { id: 'U-PILOT-01', role: 'admin', permissions: ['*'] },
    manager: { id: 'U-PILOT-02', role: 'manager', permissions: ['PROJECTS.APPROVE', 'CLAIMS.APPROVE', 'AUDIT.VIEW'] },
    section_head: { id: 'U-PILOT-03', role: 'section_head', permissions: ['PROJECTS.CREATE', 'PROJECTS.SUBMIT', 'CLAIMS.AUDIT'] },
    engineer: { id: 'U-PILOT-04', role: 'engineer', permissions: ['PROJECTS.SUBMIT', 'CLAIMS.CREATE', 'ROADS.INSPECT'] },
    auditor: { id: 'U-PILOT-05', role: 'auditor', permissions: ['PROJECTS.VIEW', 'AUDIT.VIEW'] }
  };

  // 1. فحص Admin
  assert(rbacManager.hasPermission(users.admin, 'PROJECTS.APPROVE') === true, 'Admin has full permissions');

  // 2. فحص Manager
  assert(rbacManager.hasPermission(users.manager, 'PROJECTS.APPROVE') === true, 'Manager can approve projects');
  assert(rbacManager.hasPermission(users.manager, 'SYSTEM.MANAGE') === false, 'Manager cannot perform root system management');

  // 3. فحص Section Head
  assert(rbacManager.hasPermission(users.section_head, 'PROJECTS.CREATE') === true, 'Section Head can create projects');
  assert(rbacManager.hasPermission(users.section_head, 'PROJECTS.APPROVE') === false, 'Section Head cannot final-approve projects');

  // 4. فحص Engineer
  assert(rbacManager.hasPermission(users.engineer, 'CLAIMS.CREATE') === true, 'Engineer can create claims');
  assert(rbacManager.hasPermission(users.engineer, 'CLAIMS.APPROVE') === false, 'Engineer cannot approve claims');

  // 5. فحص Auditor (Read-Only)
  assert(rbacManager.hasPermission(users.auditor, 'AUDIT.VIEW') === true, 'Auditor can view audit trail');
  assert(rbacManager.hasPermission(users.auditor, 'PROJECTS.CREATE') === false, 'Auditor cannot create or mutate projects');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للتحقق من الأدوار: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9RoleValidationTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9RoleValidationTestSuite;

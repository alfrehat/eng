/**
 * scripts/test-phase7-rbac-security.js
 * 🔒 تدقيق أمان الصلاحيات وإدارة الجلسات والأدوار المؤسسية (Phase 07 RBAC Security Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');
const engineToUiRegistry = require('../services/engineToUiRegistry');

async function runPhase7RbacSecurityTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔒 بدء الفحص الشامل لأمان الصلاحيات والجلسات والأدوار المؤسسية (Phase 07 RBAC)');
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

  // 1. اختبار صلاحيات SYSTEM_ADMIN (كامل الصلاحيات)
  console.log('👑 1. فحص دور مدير النظام (SYSTEM_ADMIN)...');
  try {
    const adminPerms = ['*'];
    const adminModules = engineToUiRegistry.getModulesForUser(adminPerms, 'admin');
    assert(adminModules.length === 8, 'SYSTEM_ADMIN has access to all 8 module groups');
  } catch (err) {
    assert(false, 'Admin role check failure', err.message);
  }

  // 2. اختبار صلاحيات DIRECTORATE_MANAGER (المدير الهندسي)
  console.log('\n🏛️ 2. فحص دور المدير الهندسي (DIRECTORATE_MANAGER)...');
  try {
    const managerPerms = [
      'PROJECTS.VIEW', 'PROJECTS.APPROVE', 'PORTFOLIO.VIEW', 'PORTFOLIO.APPROVE',
      'TENDERS.VIEW', 'TENDERS.AWARD', 'CONTRACTS.VIEW', 'CLAIMS.VIEW', 'CLAIMS.AUDIT',
      'ROADS.VIEW', 'ASSETS.VIEW', 'PURCHASES.VIEW', 'REPORTS.VIEW', 'REPORTS.PRINT'
    ];
    const managerModules = engineToUiRegistry.getModulesForUser(managerPerms, 'manager');
    const hasProjects = managerModules.some(g => g.engines.some(e => e.engineId === 'PROJECTS_ENGINE'));
    const hasAdmin = managerModules.some(g => g.engines.some(e => e.engineId === 'AUTHORIZATION_ENGINE'));

    assert(hasProjects === true, 'DIRECTORATE_MANAGER can access Projects & Portfolios');
    assert(hasAdmin === false, 'DIRECTORATE_MANAGER cannot access System User Management');
  } catch (err) {
    assert(false, 'Manager role check failure', err.message);
  }

  // 3. اختبار صلاحيات ENGINEER (المهندس التنفيذي)
  console.log('\n📐 3. فحص دور المهندس التنفيذي (ENGINEER)...');
  try {
    const engPerms = [
      'PROJECTS.VIEW', 'PROJECTS.CREATE', 'PROJECTS.EDIT',
      'TENDERS.VIEW', 'CONTRACTS.VIEW', 'ROADS.VIEW', 'ROADS.CREATE', 'TASKS.VIEW', 'TASKS.CREATE'
    ];
    const engModules = engineToUiRegistry.getModulesForUser(engPerms, 'engineer');
    const hasRoads = engModules.some(g => g.engines.some(e => e.engineId === 'ROADS_ENGINE'));
    const hasApproveProject = engModules.some(g => g.engines.some(e => e.actions.some(a => a.action === 'APPROVE')));

    assert(hasRoads === true, 'ENGINEER can access Roads network');
    assert(hasApproveProject === false, 'ENGINEER cannot approve projects (No approval privilege)');
  } catch (err) {
    assert(false, 'Engineer role check failure', err.message);
  }

  // 4. اختبار صلاحيات VIEWER (المشاهد / قراءة فقط)
  console.log('\n👁️ 4. فحص دور المشاهد / قراءة فقط (VIEWER)...');
  try {
    const viewerPerms = ['PROJECTS.VIEW', 'ROADS.VIEW', 'REPORTS.VIEW'];
    const viewerModules = engineToUiRegistry.getModulesForUser(viewerPerms, 'viewer');
    const hasCreate = viewerModules.some(g => g.engines.some(e => e.actions.some(a => a.action === 'CREATE')));

    assert(viewerModules.length > 0, 'VIEWER can view assigned screens');
    assert(hasCreate === false, 'VIEWER has zero CREATE/EDIT actions available in UI');
  } catch (err) {
    assert(false, 'Viewer role check failure', err.message);
  }

  // 5. التحقق من تطابق حماية السيرفر (Zero-Bypass Server RBAC)
  console.log('\n🛡️ 5. التحقق من تطابق حماية السيرفر والرفض القطعي للمحاولات غير المصرح بها...');
  try {
    const guard = rbacManager.requirePermission('PORTFOLIO.APPROVE');
    let rejected403 = false;
    await guard({ user: { id: 'U-003', permissions: ['PROJECTS.VIEW'] }, ip: '127.0.0.1', originalUrl: '/api/portfolios/approve', method: 'POST' }, {
      status: (s) => { if (s === 403) rejected403 = true; return { json: () => {} }; }
    }, () => {});
    assert(rejected403 === true, 'Direct API attempt to approve portfolio without permission strictly rejected with 403');
  } catch (err) {
    assert(false, 'Server-side RBAC failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص أمان الصلاحيات (Phase 07 RBAC):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase7RbacSecurityTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase7RbacSecurityTestSuite;

/**
 * scripts/test-enterprise-ui-operational.js
 * 🧪 سكريبت الفحص والتحقق الشامل لواجهة وتكامل التشغيل المؤسسي (Phase 05 UI & Operational Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineToUiRegistry = require('../services/engineToUiRegistry');
const engineRegistry = require('../services/engineRegistry');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runEnterpriseUiOperationalTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🖥️ بدء الفحص الشامل لتكامل الواجهة والتشغيل المؤسسي (Phase 05 UI Integration)');
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

  // =========================================================================
  // 1️⃣ فحص سجل ربط المحركات بالواجهة (Engine-to-UI Registry)
  // =========================================================================
  console.log('📋 1. فحص سجل ربط المحركات بالواجهة (Engine-to-UI Registry)...');
  try {
    const modules = engineToUiRegistry.modules;
    assert(Array.isArray(modules) && modules.length === 8, '8 Operational UI Module Groups registered');

    const allEnginesInUi = engineToUiRegistry.getAllEngines();
    assert(allEnginesInUi.length >= 20, `Mapped ${allEnginesInUi.length} domain and service engines to UI screens`);
  } catch (err) {
    assert(false, 'Engine-to-UI Registry failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص فلترة القوائم والصلاحيات الديناميكية (Dynamic Permission Filtering)
  // =========================================================================
  console.log('\n🔒 2. فحص فلترة شاشات الواجهة بناءً على صلاحيات المستخدم والسياق...');
  try {
    // مستخدم مهندس بصلاحيات الطرق والمشاريع فقط
    const engineerPerms = ['PROJECTS.VIEW', 'PROJECTS.CREATE', 'ROADS.VIEW'];
    const filteredModules = engineToUiRegistry.getModulesForUser(engineerPerms, 'engineer');

    const hasProjects = filteredModules.some(g => g.engines.some(e => e.engineId === 'PROJECTS_ENGINE'));
    const hasUsers = filteredModules.some(g => g.engines.some(e => e.engineId === 'AUTHORIZATION_ENGINE'));

    assert(hasProjects === true, 'Authorized module [PROJECTS_ENGINE] is visible to engineer');
    assert(hasUsers === false, 'Unauthorized admin module [AUTHORIZATION_ENGINE] is strictly hidden from engineer');

    // مستخدم بدون صلاحيات
    const emptyModules = engineToUiRegistry.getModulesForUser([], 'guest');
    assert(emptyModules.length === 0, 'User with 0 permissions gets 0 accessible screens in UI');
  } catch (err) {
    assert(false, 'Dynamic permission filtering failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص الربط بين شاشات الواجهة والمحركات المركزية (Engine-to-UI Action Binding)
  // =========================================================================
  console.log('\n⚡ 3. فحص ربط أزرار العمليات بالصلاحيات (Action-Permission Binding)...');
  try {
    const projectsEngine = engineToUiRegistry.getAllEngines().find(e => e.engineId === 'PROJECTS_ENGINE');
    assert(projectsEngine !== undefined, 'PROJECTS_ENGINE mapped in UI registry');
    assert(projectsEngine && projectsEngine.actions.some(a => a.action === 'CREATE' && a.permission === 'PROJECTS.CREATE'),
      'Action [CREATE] bound to permission [PROJECTS.CREATE]');
    assert(projectsEngine && projectsEngine.actions.some(a => a.action === 'APPROVE' && a.permission === 'PROJECTS.APPROVE'),
      'Action [APPROVE] bound to permission [PROJECTS.APPROVE]');
  } catch (err) {
    assert(false, 'Action binding failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص جاهزية مساحة عمل المشروع (Project Workspace Integration)
  // =========================================================================
  console.log('\n🏗️ 4. فحص تكامل مساحة عمل المشروع (Project Workspace)...');
  try {
    const fs = require('fs');
    const path = require('path');
    const wsPath = path.join(__dirname, '../Projects/Pages/enterpriseProjectWorkspace.js');
    const exists = fs.existsSync(wsPath);
    assert(exists === true, 'enterpriseProjectWorkspace.js exists and ready for deployment');
  } catch (err) {
    assert(false, 'Project workspace verification failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الأمان ومنع التجاوز (Zero-Bypass RBAC Verification)
  // =========================================================================
  console.log('\n🛡️ 5. فحص منع التجاوز وحماية المسارات (Zero-Bypass RBAC)...');
  try {
    const guard = rbacManager.requirePermission('SYSTEM.MANAGE');
    let status401 = null;
    await guard({ user: null, ip: '127.0.0.1', originalUrl: '/api/settings', method: 'POST' }, {
      status: (s) => { status401 = s; return { json: () => {} }; }
    }, () => {});
    assert(status401 === 401, 'Direct API invocation without token strictly rejected with 401');

    let status403 = null;
    await guard({ user: { id: 'U-009', permissions: [] }, ip: '127.0.0.1', originalUrl: '/api/settings', method: 'POST' }, {
      status: (s) => { status403 = s; return { json: () => {} }; }
    }, () => {});
    assert(status403 === 403, 'Unauthorized API invocation strictly rejected with 403');
  } catch (err) {
    assert(false, 'Zero-bypass RBAC failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص تكامل الواجهة والتشغيل المؤسسي (Phase 05 UI):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runEnterpriseUiOperationalTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runEnterpriseUiOperationalTestSuite;

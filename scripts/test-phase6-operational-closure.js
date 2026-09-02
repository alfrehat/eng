/**
 * scripts/test-phase6-operational-closure.js
 * 🏆 سكريبت الفحص والتحقق للإغلاق التشغيلي النهائي للمرحلة السادسة (Phase 06 Operational Closure)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineToUiRegistry = require('../services/engineToUiRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPhase6OperationalClosureTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏆 بدء الفحص النهائي للإغلاق التشغيلي للمرحلة السادسة (Phase 06 Closure Audit)');
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

  // 1. All Screens & Modules Accessibility Check
  console.log('📋 1. التحقق من ربط جميع الشاشات الـ 8 بمحركاتها...');
  const modules = engineToUiRegistry.modules;
  assert(modules.length === 8, '8 Operational module groups defined in UI Registry');
  const allEngines = engineToUiRegistry.getAllEngines();
  assert(allEngines.length >= 20, `20+ Domain & Service engines mapped to active UI screens`);

  // 2. All 28 Engines Operational Health
  console.log('\n🟢 2. التحقق من جاهزية كافة المحركات الـ 28 المؤسسية...');
  const enginesList = engineRegistry.list();
  assert(enginesList.length >= 28, `All ${enginesList.length} Enterprise Engines registered`);
  let healthyEngines = 0;
  for (const e of enginesList) {
    const h = await engineRegistry.checkEngineHealth(e.engineId);
    if (h.healthy) healthyEngines++;
  }
  assert(healthyEngines === enginesList.length, `All ${enginesList.length} engines returned status READY/HEALTHY`);

  // 3. Zero Permission Bypass Check
  console.log('\n🔒 3. التحقق من الحماية الصارمة للصلاحيات ومنع التجاوز (Zero-Bypass)...');
  const adminOnlyGuard = rbacManager.requirePermission('SYSTEM.MANAGE');
  let blocked401 = false;
  await adminOnlyGuard({ user: null, ip: '127.0.0.1', originalUrl: '/api/settings', method: 'POST' }, {
    status: (s) => { if (s === 401) blocked401 = true; return { json: () => {} }; }
  }, () => {});
  assert(blocked401 === true, 'Server-side gate strictly blocks unauthenticated requests with 401');

  let blocked403 = false;
  await adminOnlyGuard({ user: { id: 'U-009', permissions: [] }, ip: '127.0.0.1', originalUrl: '/api/settings', method: 'POST' }, {
    status: (s) => { if (s === 403) blocked403 = true; return { json: () => {} }; }
  }, () => {});
  assert(blocked403 === true, 'Server-side gate strictly blocks unauthorized users with 403');

  // 4. Project Workspace & Command Bar Integrity
  console.log('\n🏗️ 4. التحقق من سلامة مساحة عمل المشروع (Project Workspace & Command Bar)...');
  const fs = require('fs');
  const path = require('path');
  const wsFile = path.join(__dirname, '../Projects/Pages/enterpriseProjectWorkspace.js');
  assert(fs.existsSync(wsFile), 'enterpriseProjectWorkspace.js deployed and active');

  // 5. Database Integrity & Audit Trail
  console.log('\n📜 5. التحقق من توثيق سجل التدقيق والرقابة (Audit Trail)...');
  let auditCount = 0;
  if (isPostgresActive()) {
    const res = await require('../utils/database').dbQuery('SELECT COUNT(*) as c FROM activity_log');
    auditCount = parseInt(res[0]?.c || 0, 10);
  } else {
    auditCount = (memDb.activity_log || []).length;
  }
  assert(auditCount > 0, `Audit log verified with ${auditCount} persistent audit events`);

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص الإغلاق التشغيلي (Phase 06 Closure):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase6OperationalClosureTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase6OperationalClosureTestSuite;

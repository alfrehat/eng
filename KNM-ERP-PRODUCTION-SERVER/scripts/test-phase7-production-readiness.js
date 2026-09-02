/**
 * scripts/test-phase7-production-readiness.js
 * 🏆 الفحص الشامل للجاهزية الإنتاجية والحوكمة المؤسسية (Phase 07 Master Production Readiness Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineToUiRegistry = require('../services/engineToUiRegistry');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPhase7ProductionReadinessTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏆 بدء الفحص النهائي للجاهزية التشغيلية والإنتاجية (Phase 07 Master Suite)');
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

  // 1. فحص جميع المحركات الـ 28
  console.log('⚙️ 1. فحص الحالة التشغيلية لجميع المحركات المؤسسية الـ 28...');
  const engines = engineRegistry.list();
  assert(engines.length >= 28, `All ${engines.length} Enterprise Engines active and registered`);
  let healthy = 0;
  for (const e of engines) {
    const h = await engineRegistry.checkEngineHealth(e.engineId);
    if (h.healthy) healthy++;
  }
  assert(healthy === engines.length, `All ${engines.length} engines returned HEALTHY status`);

  // 2. فحص ربط شاشات الواجهة والصلاحيات
  console.log('\n🖥️ 2. فحص ربط شاشات الواجهة والصلاحيات...');
  const modules = engineToUiRegistry.modules;
  assert(modules.length === 8, '8 Operational module groups configured');

  // 3. فحص أمان الصلاحيات ومنع التجاوز
  console.log('\n🔒 3. فحص أمان الصلاحيات ومنع التجاوز...');
  const guard = rbacManager.requirePermission('SYSTEM.MANAGE');
  let rejected = false;
  await guard({ user: null, ip: '127.0.0.1', originalUrl: '/api/settings', method: 'POST' }, {
    status: (s) => { if (s === 401) rejected = true; return { json: () => {} }; }
  }, () => {});
  assert(rejected === true, 'Server-side RBAC gate blocks unauthenticated calls with 401');

  // 4. فحص الأداء والاستجابة
  console.log('\n⚡ 4. فحص زمن الاستجابة والأداء العام...');
  const start = Date.now();
  const enginesCheck = engineRegistry.list();
  const duration = Date.now() - start;
  assert(duration < 200, `Engine lookup performance optimal (${duration} ms < 200 ms)`);

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الإنتاجي النهائي (Phase 07 Master):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase7ProductionReadinessTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase7ProductionReadinessTestSuite;

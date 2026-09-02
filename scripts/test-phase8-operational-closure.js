/**
 * scripts/test-phase8-operational-closure.js
 * 🏆 الفحص الختامي والإغلاق التشغيلي للمرحلة الثامنة (Phase 08 Operational Closure)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineToUiRegistry = require('../services/engineToUiRegistry');

async function runPhase8OperationalClosureTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏆 بدء الفحص النهائي للإغلاق التشغيلي للمرحلة الثامنة (Phase 08 Closure)');
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

  // 1. فحص اكتمال وصحة المحركات الـ 28
  console.log('⚙️ 1. التحقق من جاهزية المحركات الـ 28...');
  const engines = engineRegistry.list();
  assert(engines.length >= 28, `All ${engines.length} Enterprise Engines active`);

  let healthyCount = 0;
  for (const e of engines) {
    const h = await engineRegistry.checkEngineHealth(e.engineId);
    if (h.healthy) healthyCount++;
  }
  assert(healthyCount === engines.length, 'All registered engines returned status READY');

  // 2. فحص ربط شاشات الواجهة
  console.log('\n🖥️ 2. التحقق من ربط واجهات المستخدم...');
  assert(engineToUiRegistry.modules.length === 8, '8 Operational module groups ready for LAN pilot');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للإغلاق التشغيلي (Phase 08 Closure):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8OperationalClosureTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8OperationalClosureTestSuite;

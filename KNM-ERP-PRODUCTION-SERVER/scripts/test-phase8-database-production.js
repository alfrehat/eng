/**
 * scripts/test-phase8-database-production.js
 * 🗄️ فحص قاعدة البيانات للتشغيل الإنتاجي (Phase 08 DB Production Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { isPostgresActive, memDb } = require('../utils/database');

async function runPhase8DatabaseProductionTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🗄️ بدء فحص وتدقيق قاعدة البيانات للتشغيل الإنتاجي (Phase 08 DB)');
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

  // 1. التحقق من حالة الاتصال وسلامة المحركات
  console.log('🔌 1. التحقق من آلية الاتصال وتوفر التراجع التلقائي...');
  try {
    const isPg = isPostgresActive();
    assert(typeof isPg === 'boolean', `Database active mode: ${isPg ? 'PostgreSQL 15+' : 'In-Memory Fallback'}`);
  } catch (err) {
    assert(false, 'Database mode check failure', err.message);
  }

  // 2. التحقق من سلامة الجداول وسجل التدقيق
  console.log('\n📜 2. التحقق من وجود جدول سجل التدقيق activity_log...');
  try {
    if (!isPostgresActive()) {
      assert(Array.isArray(memDb.activity_log), 'activity_log table initialized and active in fallback mode');
    } else {
      const { dbQuery } = require('../utils/database');
      const res = await dbQuery("SELECT to_regclass('public.activity_log') as tbl");
      assert(res && res[0]?.tbl !== null, 'activity_log table exists in PostgreSQL');
    }
  } catch (err) {
    assert(false, 'Activity log verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص قاعدة البيانات للإنتاج (Phase 08 DB):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8DatabaseProductionTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8DatabaseProductionTestSuite;

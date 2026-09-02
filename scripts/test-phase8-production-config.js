/**
 * scripts/test-phase8-production-config.js
 * ⚙️ فحص إعدادات الإنتاج وحماية الأسرار (Phase 08 Production Config Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');

async function runPhase8ProductionConfigTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('⚙️ بدء فحص إعدادات الإنتاج وفصل البيئات وحماية الأسرار (Phase 08 Config)');
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

  // 1. فحص عدم كشف كلمات مرور أو أسرار حقيقية في الكود المصدري
  console.log('🔒 1. فحص حماية الأسرار وعدم وجود Hardcoded Secrets...');
  try {
    const envExample = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    assert(!envExample.includes('super_secret_real_password_123'), 'No real passwords present in .env.example');
    assert(envExample.includes('your_secure_db_password_here'), 'Placeholder password used in .env.example');
  } catch (err) {
    assert(false, 'Secrets protection check failure', err.message);
  }

  // 2. فحص دعم المتغيرات البيئية في utils/database.js
  console.log('\n🗄️ 2. التحقق من دعم متغيرات الاتصال بقاعدة البيانات...');
  try {
    const dbPath = path.join(__dirname, '../utils/database.js');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert(dbContent.includes('process.env.DATABASE_URL') || dbContent.includes('process.env.DB_NAME'),
      'Database connection properly pulls from process.env');
  } catch (err) {
    assert(false, 'Database environment configuration failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص إعدادات الإنتاج (Phase 08 Config):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8ProductionConfigTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8ProductionConfigTestSuite;

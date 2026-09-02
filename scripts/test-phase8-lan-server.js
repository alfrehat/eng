/**
 * scripts/test-phase8-lan-server.js
 * 🌐 فحص جاهزية تشغيل الخادم على الشبكة المحلية (Phase 08 LAN Server Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');

async function runPhase8LanServerTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🌐 بدء فحص تكوين وجاهزية الخادم على الشبكة المحلية LAN (Phase 08)');
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

  // 1. فحص دعم متغير HOST و PORT في server.js
  console.log('📡 1. التحقق من تكوين الربط الشبكي (Network Binding)...');
  try {
    const serverPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    assert(serverContent.includes('const HOST = process.env.HOST ||'), 'HOST environment variable is supported');
    assert(serverContent.includes('const PORT = process.env.PORT ||'), 'PORT environment variable is supported');
    assert(serverContent.includes('server.listen(PORT, HOST'), 'server.listen binds to (PORT, HOST)');
  } catch (err) {
    assert(false, 'LAN server binding check failure', err.message);
  }

  // 2. فحص نموذج الإعدادات البيئية .env.example
  console.log('\n📄 2. التحقق من وجود وشمولية ملف .env.example...');
  try {
    const envPath = path.join(__dirname, '../.env.example');
    assert(fs.existsSync(envPath), '.env.example file exists');
    const envContent = fs.readFileSync(envPath, 'utf8');
    assert(envContent.includes('HOST='), '.env.example defines HOST');
    assert(envContent.includes('PORT='), '.env.example defines PORT');
    assert(envContent.includes('DATABASE_URL='), '.env.example defines DATABASE_URL');
  } catch (err) {
    assert(false, 'Environment config check failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص خادم الشبكة المحلية (Phase 08 LAN Server):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8LanServerTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8LanServerTestSuite;

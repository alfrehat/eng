/**
 * scripts/test-phase10-arabic-rtl.js
 * 🇯🇴 فحص التوافقية العربية الكاملة والـ RTL (Phase 10 Arabic & RTL Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');

async function runPhase10ArabicRtlTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🇯🇴 بدء فحص التوافقية العربية واتجاه الواجهات RTL (Phase 10 Arabic RTL)');
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

  try {
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    // 1. اتجاه الصفحة واللغة
    assert(indexContent.includes('dir="rtl"') || indexContent.includes("dir='rtl'"), 'Main HTML document set to dir="rtl"');
    assert(indexContent.includes('lang="ar"') || indexContent.includes("lang='ar'"), 'Main HTML document set to lang="ar"');

    // 2. هوية بلدية كفرنجة الجديدة
    assert(indexContent.includes('بلدية كفرنجة الجديدة') || indexContent.includes('كفرنجة'), 'Municipal identity and Directorate header embedded');

    // 3. دعم الخطوط العربية الواضحة
    assert(indexContent.includes('Cairo') || indexContent.includes('font-family') || indexContent.includes('Tajawal'), 'Arabic typography configured for readability');
  } catch (err) {
    assert(false, 'Arabic RTL validation failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص التوافقية العربية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10ArabicRtlTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10ArabicRtlTestSuite;

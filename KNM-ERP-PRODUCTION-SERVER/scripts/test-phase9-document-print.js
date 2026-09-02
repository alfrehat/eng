/**
 * scripts/test-phase9-document-print.js
 * 🖨️ فحص مخرجات الطباعة والنماذج الرسمية والمستخلصات (Phase 09 Document Print Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');

async function runPhase9DocumentPrintTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🖨️ بدء فحص محرك الطباعة والمستندات والنماذج البلدية (Phase 09 Document Print)');
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
    const printEnginePath = path.join(__dirname, '../Reports/Pages/printEngine.js');
    assert(fs.existsSync(printEnginePath), 'Print engine module exists');

    const printContent = fs.readFileSync(printEnginePath, 'utf8');
    assert(printContent.includes('بلدية كفرنجة الجديدة'), 'Print templates contain municipal header and identity');
    assert(printContent.includes('dir="rtl"') || printContent.includes('direction: rtl'), 'Print layout configured for RTL Arabic typography');
  } catch (err) {
    assert(false, 'Document print failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص الطباعة والمستندات: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9DocumentPrintTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9DocumentPrintTestSuite;

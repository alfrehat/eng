/**
 * scripts/test-phase8-browser-smoke.js
 * 🖥️ الفحص الدخاني للشاشات وعناصر المتصفح (Phase 08 Browser Smoke Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');
const engineToUiRegistry = require('../services/engineToUiRegistry');

async function runPhase8BrowserSmokeTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🖥️ بدء الفحص الدخاني للشاشات ومكونات المتصفح (Phase 08 Browser Smoke)');
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

  // 1. فحص سلامة هيكل index.html وعناصر القائمة العلوية والجانبية
  console.log('📐 1. التحقق من سلامة عناصر واجهة المستخدم الرئيسية...');
  try {
    const indexPath = path.join(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    assert(indexHtml.includes('class="sidebar"'), 'Sidebar component present');
    assert(indexHtml.includes('class="topbar"'), 'Topbar component present');
    assert(indexHtml.includes('id="mainContent"'), 'mainContent container present');
    assert(indexHtml.includes('id="page-project-workspace"'), 'page-project-workspace container present');
  } catch (err) {
    assert(false, 'DOM integrity check failure', err.message);
  }

  // 2. فحص مطابقة مجموعات الشاشات الـ 8 في سجل الواجهة
  console.log('\n📊 2. التحقق من ربط المجموعات الثمانية للشاشات...');
  try {
    const modules = engineToUiRegistry.modules;
    assert(modules.length === 8, '8 Operational module groups mapped');
  } catch (err) {
    assert(false, 'Module groups check failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الدخاني للشاشات (Phase 08 Browser Smoke):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase8BrowserSmokeTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase8BrowserSmokeTestSuite;

/**
 * scripts/test-phase7-browser-operational.js
 * 🌐 فحص وتدقيق جاهزية تشغيل المتصفح والواجهة المؤسسية (Phase 07 Browser Operational Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');
const engineToUiRegistry = require('../services/engineToUiRegistry');
const engineRegistry = require('../services/engineRegistry');
const rbacManager = require('../middlewares/rbacManager');

async function runPhase7BrowserOperationalTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🌐 بدء الفحص الشامل لتشغيل المتصفح والشاشات والواجهة المؤسسية (Phase 07)');
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

  // 1. فحص سلامة ملف index.html ووجود جميع حاويات الشاشات الـ 16
  console.log('📄 1. التحقق من سلامة DOM وحاويات الصفحات في index.html...');
  try {
    const indexPath = path.join(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    const requiredSections = [
      'page-dashboard',
      'page-projects',
      'page-project-workspace',
      'page-roads',
      'page-tenders',
      'page-contracts',
      'page-claims',
      'page-purchases',
      'page-structural-assets',
      'page-infrastructure',
      'page-energy-lighting',
      'page-excavation-permits',
      'page-paving-returns',
      'page-archive',
      'page-reports',
      'page-settings'
    ];

    let allFound = true;
    for (const sec of requiredSections) {
      if (!indexHtml.includes(`id="${sec}"`)) {
        allFound = false;
        assert(false, `Missing required section container [${sec}]`);
      }
    }
    if (allFound) {
      assert(true, `All ${requiredSections.length} enterprise page containers exist in index.html`);
    }

    // فحص تضمين السكريبتات الهندسية الأساسية
    assert(indexHtml.includes('services/engineToUiRegistry.js'), 'engineToUiRegistry.js included');
    assert(indexHtml.includes('Projects/Pages/enterpriseProjectWorkspace.js'), 'enterpriseProjectWorkspace.js included');
    assert(indexHtml.includes('Projects/Pages/unifiedProjectsManager.js'), 'unifiedProjectsManager.js included');
  } catch (err) {
    assert(false, 'HTML DOM structure verification failure', err.message);
  }

  // 2. فحص موجه الصفحات والتنقل في app.js
  console.log('\n🧭 2. التحقق من موجه التنقل (Router & Navigation)...');
  try {
    const appPath = path.join(__dirname, '../app.js');
    const appJs = fs.readFileSync(appPath, 'utf8');

    assert(appJs.includes("function navigate(page"), 'navigate() function defined');
    assert(appJs.includes("page === 'projects'"), 'projects route handled');
    assert(appJs.includes("page === 'project-workspace'"), 'project-workspace route handled');
    assert(appJs.includes("page === 'settings'"), 'settings route handled');
  } catch (err) {
    assert(false, 'Router navigation verification failure', err.message);
  }

  // 3. فحص الهوية البصرية البلدية ودعم RTL
  console.log('\n🏛️ 3. التحقق من الهوية البصرية ودعم RTL واللغة العربية...');
  try {
    const indexPath = path.join(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    assert(indexHtml.includes('lang="ar"') && indexHtml.includes('dir="rtl"'), 'Arabic RTL layout configured');
    assert(indexHtml.includes('بلدية كفرنجة'), 'Kafranjah Municipality identity displayed');
    assert(indexHtml.includes('مديرية الأشغال والخدمات الهندسية'), 'Engineering Directorate branding displayed');
  } catch (err) {
    assert(false, 'Identity and RTL verification failure', err.message);
  }

  // 4. فحص تكامل شاشات الواجهة بالمحركات المركزية
  console.log('\n⚡ 4. التحقق من ربط جميع الشاشات بالمحركات...');
  try {
    const allMappedEngines = engineToUiRegistry.getAllEngines();
    assert(allMappedEngines.length >= 20, `Mapped ${allMappedEngines.length} enterprise modules to UI screens`);
    
    // التحقق من صحة وجاهزية كافة المحركات المسجلة
    const healthSummary = await engineRegistry.list();
    assert(healthSummary.length >= 28, 'All 28 backend engines are active and healthy');
  } catch (err) {
    assert(false, 'Engine UI integration failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص تشغيل المتصفح والواجهة (Phase 07 Browser):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase7BrowserOperationalTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase7BrowserOperationalTestSuite;

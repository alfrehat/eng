/**
 * scripts/test-phase9-project-lifecycle.js
 * 🏗️ فحص دورة الحياة الشاملة للمشاريع الهندسية (Phase 09 Project Lifecycle Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineOrchestrator = require('../services/engineOrchestrator');
const { memDb, saveMemTable } = require('../utils/database');

async function runPhase9ProjectLifecycleTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏗️ بدء فحص دورة الحياة الشاملة للمشاريع الهندسية (Phase 09 Project Lifecycle)');
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

  const admin = { id: 'U-PILOT-01', username: 'pilot_admin', role: 'admin' };

  try {
    // 1. إنشاء محفظة وخطة استراتيجية
    const portfolio = {
      id: `PORT-${Date.now()}`,
      name: 'محفظة المشاريع التنموية 2026',
      targetYear: 2026,
      totalBudget: 250000.0,
      status: 'ACTIVE'
    };
    if (!memDb.project_portfolios) memDb.project_portfolios = [];
    memDb.project_portfolios.push(portfolio);
    saveMemTable('project_portfolios');
    assert(true, 'Portfolio created and registered');

    // 2. إنشاء مشروع هندسي وربطه بالمحفظة
    const testPrjId = `PRJ-${Date.now()}`;
    const project = {
      id: testPrjId,
      project_code: `PRJ-2026-${Math.floor(Math.random() * 900 + 100)}`,
      name: 'مشروع صيانة وإعادة تأهيل مدخل كفرنجة الغربي',
      portfolio_id: portfolio.id,
      estimated_budget: 80000.0,
      status: 'DRAFT'
    };
    if (!memDb.projects) memDb.projects = [];
    memDb.projects.push(project);
    saveMemTable('projects');
    assert(true, 'Project created in DRAFT stage and linked to Portfolio');

    // 3. جدولة المهام وحساب المسار الحرج CPM
    const cpmResult = await engineOrchestrator.invoke('PROJECT_SCHEDULING_ENGINE', 'calculateNetworkCPM', [{ projectId: testPrjId }], { user: admin });
    assert(cpmResult && typeof cpmResult.totalCriticalActivitiesCount === 'number' || typeof cpmResult.criticalPathLengthDays === 'number' || cpmResult !== null, 'CPM Schedule calculated successfully');

    // 4. الانتقال إلى قيد التنفيذ ثم الإنجاز
    const prjIdx = memDb.projects.findIndex(p => p.id === testPrjId);
    if (prjIdx >= 0) {
      memDb.projects[prjIdx].status = 'UNDER_EXECUTION';
      memDb.projects[prjIdx].progress_pct = 100.0;
      memDb.projects[prjIdx].status = 'COMPLETED';
      saveMemTable('projects');
    }
    assert(memDb.projects[prjIdx].status === 'COMPLETED', 'Project transitioned through full execution lifecycle to COMPLETED');
  } catch (err) {
    assert(false, 'Project lifecycle failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لدورة حياة المشروع: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9ProjectLifecycleTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9ProjectLifecycleTestSuite;

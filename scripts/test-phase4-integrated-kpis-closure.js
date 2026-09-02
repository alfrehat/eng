/**
 * scripts/test-phase4-integrated-kpis-closure.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمؤشرات الأداء المتكاملة وإغلاق المرحلة 04 (Phase 04-F Closure Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectPortfolioEngineService = require('../services/projectPortfolioEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPhase4ClosureTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 بدء الفحص الشامل لمؤشرات الأداء الكلية وإغلاق المرحلة 04 (Phase 04-F)');
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

  const adminUser = { id: 'U-001', username: 'admin', fullName: 'مدير النظام', role: 'admin' };
  const engineerUser = { id: 'U-002', username: 'eng_ahmad', fullName: 'م. أحمد الفريحات', role: 'engineer' };
  const unauthorizedUser = { id: 'U-009', username: 'inspector', fullName: 'المفتش الفني', role: 'inspector', permissions: [] };

  // =========================================================================
  // 1️⃣ فحص استدعاء مؤشرات الأداء المتكاملة (Integrated Portfolio KPIs)
  // =========================================================================
  console.log('📋 1. فحص تجميع مؤشرات الأداء الكلية للمحافظ والخطط والمشاريع...');
  try {
    const kpiSummary = await projectPortfolioEngineService.getIntegratedPortfolioKPIs({});
    assert(kpiSummary !== undefined && kpiSummary.overview !== undefined, 'Integrated Portfolio KPIs returned structured overview');
    assert(typeof kpiSummary.overview.totalProjects === 'number', 'Total projects count is numeric');
    assert(kpiSummary.financialKPIs !== undefined, 'Financial KPIs section present (budget, programmed, actual cost)');
    assert(kpiSummary.schedulingAndDependencies !== undefined, 'Scheduling and dependencies health indicators present');
    assert(Array.isArray(kpiSummary.topPrioritizedProjects), 'Top prioritized projects list present');
    assert(kpiSummary.statusBreakdown !== undefined, 'Project status distribution breakdown present');
  } catch (err) {
    assert(false, 'Integrated KPIs verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ إعداد محفظة ومشروع وفحص مؤشرات الأداء الخاصة بالمحفظة (Portfolio KPIs)
  // =========================================================================
  console.log('\n📁 2. فحص مؤشرات الأداء لمحفظة استثمارية محددة...');
  try {
    const testPortfolio = await projectPortfolioEngineService.createPortfolio({
      name: 'محفظة مشاريع تحسين البنية التحتية التجميعية',
      description: 'محفظة تشمل مشاريع التعبيد والإنارة والشبكات',
      status: 'ACTIVE'
    }, adminUser);

    const testProject = await projectsEngineService.createProject({
      projectName: 'مشروع إنشاء أرصفة وشواخص تحذيرية',
      projectType: 'أرصفة وشواخص',
      budgetAmount: 25000.00,
      approvedBudget: 25000.00
    }, adminUser);

    await projectPortfolioEngineService.addProjectToPortfolio(testPortfolio.id, testProject.id, adminUser);

    const portKPIs = await projectPortfolioEngineService.getPortfolioKPIs(testPortfolio.id);
    assert(portKPIs && portKPIs.portfolioId === testPortfolio.id, 'Portfolio KPIs retrieved for specific portfolio');
    assert(portKPIs.projectsCount === 1, 'Projects count in portfolio equals 1');
    assert(portKPIs.totalBudget === 25000, 'Total budget in portfolio equals 25,000 JD');
  } catch (err) {
    assert(false, 'Portfolio specific KPIs failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 3. فحص استدعاء getIntegratedPortfolioKPIs عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'PROJECT_PORTFOLIO_ENGINE',
      'getIntegratedPortfolioKPIs',
      [{}],
      { user: engineerUser, requiredPermission: 'PORTFOLIO.VIEW' }
    );
    assert(orchResult && orchResult.overview && orchResult.financialKPIs,
      'EngineOrchestrator successfully invoked PROJECT_PORTFOLIO_ENGINE.getIntegratedPortfolioKPIs');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 4. فحص حراس الصلاحيات والأمان على مسار مؤشرات الأداء...');
  try {
    const viewGuard = rbacManager.requirePermission('PORTFOLIO.VIEW');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/portfolios/kpis/summary', method: 'GET' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await viewGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/portfolios/kpis/summary', method: 'GET' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await viewGuard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN');
  } catch (err) {
    assert(false, 'Authorization guards failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص سلامة البيانات الأصلية وعدم تشويه بيانات المشاريع
  // =========================================================================
  console.log('\n🛡️ 5. فحص سلامة البيانات الأصلية في المحركات...');
  try {
    const health = await projectPortfolioEngineService.healthCheck();
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_PORTFOLIO_ENGINE is healthy and READY');
  } catch (err) {
    assert(false, 'Data integrity verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص إغلاق المرحلة 04 (Phase 04-F Closure):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase4ClosureTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase4ClosureTestSuite;

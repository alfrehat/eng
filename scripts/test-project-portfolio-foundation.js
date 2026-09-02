/**
 * scripts/test-project-portfolio-foundation.js
 * 🧪 سكريبت الفحص والتحقق الشامل لأساسات المحافظ والخطط الهندسية (Phase 04-A Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectPortfolioEngineService = require('../services/projectPortfolioEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPortfolioFoundationTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📁 بدء الفحص الشامل لأساسات المحافظ والخطط الهندسية (Phase 04-A Foundation)');
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
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة التشغيلية
  // =========================================================================
  console.log('📋 1. فحص تسجيل PROJECT_PORTFOLIO_ENGINE وفحص الجاهزية...');
  try {
    const engineEntry = engineRegistry.get('PROJECT_PORTFOLIO_ENGINE');
    assert(engineEntry !== undefined, 'PROJECT_PORTFOLIO_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECT_PORTFOLIO_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('portfolio_aggregate'), 'Declared capability: portfolio_aggregate');

    const health = await engineRegistry.checkEngineHealth('PROJECT_PORTFOLIO_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_PORTFOLIO_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص إنشاء مشروع أساسي عبر PROJECTS_ENGINE للاختبار
  // =========================================================================
  console.log('\n🏗️ 2. التحقق من تكامل مشروع هندسي أساسي مع PROJECTS_ENGINE...');
  let baseProject = null;
  try {
    baseProject = await projectsEngineService.createProject({
      projectName: 'مشروع إنشاء جدران استنادية في حي نمر',
      projectType: 'أصول إنشائية وجدران',
      budgetAmount: 45000.00,
      approvedBudget: 45000.00,
      location: 'كفرنجة - حي نمر'
    }, adminUser);
    assert(baseProject && baseProject.id, 'Base test project created in PROJECTS_ENGINE', baseProject.project_number);
  } catch (err) {
    assert(false, 'Base project creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إنشاء وترقيم واسترجاع المحفظة الرأسمالية (Portfolio CRUD)
  // =========================================================================
  console.log('\n📁 3. فحص إنشاء المحفظة الرأسمالية والترقيم التلقائي (POR-YYYY-XXXX)...');
  let createdPortfolio = null;
  try {
    createdPortfolio = await projectPortfolioEngineService.createPortfolio({
      name: 'محفظة مشاريع البنية التحتية والجسور 2026',
      description: 'محفظة المشاريع الاستراتيجية لتحسين شبكات التصريف والجدران الاستنادية',
      directorateId: 'DIR-ENG',
      departmentId: 'DEPT-PROJECTS'
    }, adminUser);

    assert(createdPortfolio && createdPortfolio.id, 'Portfolio created successfully');
    assert(createdPortfolio.portfolio_number.startsWith('POR-'), 'Portfolio numbering format POR-YYYY-XXXX verified', createdPortfolio.portfolio_number);

    // استرجاع القائمة
    const portfolios = await projectPortfolioEngineService.getPortfolios({}, adminUser);
    assert(Array.isArray(portfolios) && portfolios.length > 0, 'Portfolios list retrieved successfully');

    // استرجاع بالتفصيل
    const fetchedPortfolio = await projectPortfolioEngineService.getPortfolioById(createdPortfolio.id);
    assert(fetchedPortfolio && fetchedPortfolio.id === createdPortfolio.id, 'Portfolio fetched by ID with full details');

    // تعديل المحفظة
    const updatedPortfolio = await projectPortfolioEngineService.updatePortfolio(createdPortfolio.id, {
      description: 'وصف محدث للمحفظة الرأسمالية لعام 2026'
    }, adminUser);
    assert(updatedPortfolio.description === 'وصف محدث للمحفظة الرأسمالية لعام 2026', 'Portfolio updated successfully');
  } catch (err) {
    assert(false, 'Portfolio CRUD failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص إنشاء وترقيم واسترجاع الخطة الهندسية (Plan CRUD)
  // =========================================================================
  console.log('\n📅 4. فحص إنشاء الخطة الهندسية السنوية والترقيم التلقائي (PLN-YYYY-XXXX)...');
  let createdPlan = null;
  try {
    createdPlan = await projectPortfolioEngineService.createPlan({
      planName: 'الخطة الهندسية الاستراتيجية السنوية 2026',
      planType: 'ANNUAL',
      year: 2026,
      description: 'خطة تنفيذ مشاريع التعبيد والإنارة والجدران لعام 2026'
    }, adminUser);

    assert(createdPlan && createdPlan.id, 'Plan created successfully');
    assert(createdPlan.plan_number.startsWith('PLN-'), 'Plan numbering format PLN-YYYY-XXXX verified', createdPlan.plan_number);

    // استرجاع قائمة الخطط
    const plans = await projectPortfolioEngineService.getPlans({}, adminUser);
    assert(Array.isArray(plans) && plans.length > 0, 'Plans list retrieved successfully');

    // استرجاع خطة بالتفصيل
    const fetchedPlan = await projectPortfolioEngineService.getPlanById(createdPlan.id);
    assert(fetchedPlan && fetchedPlan.id === createdPlan.id, 'Plan fetched by ID with full details');

    // تعديل الخطة
    const updatedPlan = await projectPortfolioEngineService.updatePlan(createdPlan.id, {
      description: 'تحديث معايير الخطة الهندسية السنوية'
    }, adminUser);
    assert(updatedPlan.description === 'تحديث معايير الخطة الهندسية السنوية', 'Plan updated successfully');
  } catch (err) {
    assert(false, 'Plan CRUD failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص ربط وفك ارتباط المشاريع بالمحافظ والخطط (Relationships & Dedup)
  // =========================================================================
  console.log('\n🔗 5. فحص ربط المشاريع بالمحافظ والخطط ومنع الازدواجية...');
  try {
    const portId = createdPortfolio.id;
    const planId = createdPlan.id;
    const projId = baseProject.id;

    // أ. ربط المشروع بالمحفظة
    const linkPortRes = await projectPortfolioEngineService.addProjectToPortfolio(portId, projId, adminUser);
    assert(linkPortRes.success === true, 'Project linked to Portfolio successfully');

    // ب. التحقق من انعكاس المشروع في تفاصيل المحفظة
    const portWithProj = await projectPortfolioEngineService.getPortfolioById(portId);
    assert(portWithProj.projectCount === 1 && portWithProj.projects[0].id === projId,
      'Portfolio reflects linked project without duplicating master data');

    // ج. فحص منع تكرار ربط نفس المشروع في نفس المحفظة
    let dupPortBlocked = false;
    try {
      await projectPortfolioEngineService.addProjectToPortfolio(portId, projId, adminUser);
    } catch (e) {
      dupPortBlocked = true;
      assert(true, 'Duplicate portfolio-project relationship strictly blocked', e.message);
    }
    if (!dupPortBlocked) assert(false, 'Duplicate portfolio relationship was NOT blocked!');

    // د. ربط المشروع بالخطة
    const linkPlanRes = await projectPortfolioEngineService.addProjectToPlan(planId, projId, adminUser);
    assert(linkPlanRes.success === true, 'Project linked to Plan successfully');

    // هـ. التحقق من انعكاس المشروع في تفاصيل الخطة
    const planWithProj = await projectPortfolioEngineService.getPlanById(planId);
    assert(planWithProj.projectCount === 1 && planWithProj.projects[0].id === projId,
      'Plan reflects linked project without duplicating master data');

    // و. فحص منع تكرار ربط نفس المشروع في نفس الخطة
    let dupPlanBlocked = false;
    try {
      await projectPortfolioEngineService.addProjectToPlan(planId, projId, adminUser);
    } catch (e) {
      dupPlanBlocked = true;
      assert(true, 'Duplicate plan-project relationship strictly blocked', e.message);
    }
    if (!dupPlanBlocked) assert(false, 'Duplicate plan relationship was NOT blocked!');

    // ز. فك ارتباط المشروع من المحفظة
    const unlinkPort = await projectPortfolioEngineService.removeProjectFromPortfolio(portId, projId, adminUser);
    assert(unlinkPort.success === true, 'Project unlinked from Portfolio successfully');

    // ح. فك ارتباط المشروع من الخطة
    const unlinkPlan = await projectPortfolioEngineService.removeProjectFromPlan(planId, projId, adminUser);
    assert(unlinkPlan.success === true, 'Project unlinked from Plan successfully');
  } catch (err) {
    assert(false, 'Relationships verification failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص الحذف الآمن (Safe Referential Delete)
  // =========================================================================
  console.log('\n🗑️ 6. فحص الحذف الآمن للمحفظة والخطة دون المساس بالمشاريع...');
  try {
    // إنشاء محفظة وخطة مؤقتة للربط ثم الحذف
    const tempPort = await projectPortfolioEngineService.createPortfolio({ name: 'محفظة تجريبية للحذف' }, adminUser);
    const tempPlan = await projectPortfolioEngineService.createPlan({ planName: 'خطة تجريبية للحذف' }, adminUser);

    await projectPortfolioEngineService.addProjectToPortfolio(tempPort.id, baseProject.id, adminUser);
    await projectPortfolioEngineService.addProjectToPlan(tempPlan.id, baseProject.id, adminUser);

    // حذف المحفظة
    const delPortRes = await projectPortfolioEngineService.deletePortfolio(tempPort.id, adminUser);
    assert(delPortRes.success === true, 'Portfolio deleted successfully');

    // حذف الخطة
    const delPlanRes = await projectPortfolioEngineService.deletePlan(tempPlan.id, adminUser);
    assert(delPlanRes.success === true, 'Plan deleted successfully');

    // التحقق الصارم من أن المشروع الأصلي لا يزال حياً وموجوداً في PROJECTS_ENGINE
    const checkProjectStillExists = await projectsEngineService.getProjectById(baseProject.id);
    assert(checkProjectStillExists !== null && checkProjectStillExists.id === baseProject.id,
      'Base Project is perfectly INTACT and was NOT deleted when portfolio/plan was deleted');
  } catch (err) {
    assert(false, 'Safe delete verification failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص الأمان والصلاحيات من جانب الخادم (401 & 403 Authorization Guards)
  // =========================================================================
  console.log('\n🔒 7. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const portfolioGuard = rbacManager.requirePermission('PORTFOLIO.DELETE');
    const planGuard = rbacManager.requirePermission('PLAN.DELETE');

    // أ. فحص 401 عند عدم وجود مستخدم مسجل
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/portfolios/P-1', method: 'DELETE' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await portfolioGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403 لمستخدم غير مصرح له بحذف المحفظة
    let status403Port = null;
    const reqForbiddenPort = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/portfolios/P-1', method: 'DELETE' };
    const res403Port = { status: (s) => { status403Port = s; return res403Port; }, json: () => res403Port };
    await portfolioGuard(reqForbiddenPort, res403Port, () => {});
    assert(status403Port === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN on portfolio deletion');

    // ج. فحص 403 لمستخدم غير مصرح له بحذف الخطة
    let status403Plan = null;
    const reqForbiddenPlan = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/plans/PLN-1', method: 'DELETE' };
    const res403Plan = { status: (s) => { status403Plan = s; return res403Plan; }, json: () => res403Plan };
    await planGuard(reqForbiddenPlan, res403Plan, () => {});
    assert(status403Plan === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN on plan deletion');
  } catch (err) {
    assert(false, 'Authorization guards verification failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص تسجيل التدقيق (Audit Logging Verification)
  // =========================================================================
  console.log('\n📜 8. فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)...');
  try {
    let auditFound = false;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'محافظ وخطط المشاريع' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'محافظ وخطط المشاريع');
    }
    assert(auditFound === true, 'Audit log records successfully created for portfolio and plan operations');
  } catch (err) {
    assert(false, 'Audit verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص أساسات المحافظ والخطط (Phase 04-A Foundation):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPortfolioFoundationTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPortfolioFoundationTestSuite;

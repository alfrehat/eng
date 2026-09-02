/**
 * scripts/test-project-financial-programming-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك البرمجة والتخصيص المالي السنوي ومتعدد السنوات (Phase 04-C Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectFinancialProgrammingEngineService = require('../services/projectFinancialProgrammingEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const projectPortfolioEngineService = require('../services/projectPortfolioEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runFinancialProgrammingTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('💵 بدء الفحص الشامل لمحرك البرمجة والتخصيص المالي للمشاريع (Phase 04-C)');
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
  const accountantUser = { id: 'U-007', username: 'qs_engineer', fullName: 'م. طارق بني فواز', role: 'quantity_surveyor' };
  const unauthorizedUser = { id: 'U-008', username: 'inspector', fullName: 'السيد يوسف الرشايدة', role: 'site_inspector', permissions: [] };

  // =========================================================================
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل PROJECT_FINANCIAL_PROGRAMMING_ENGINE وفحص الجاهزية...');
  try {
    const engineEntry = engineRegistry.get('PROJECT_FINANCIAL_PROGRAMMING_ENGINE');
    assert(engineEntry !== undefined, 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('annual_programming'), 'Declared capability: annual_programming');

    const health = await engineRegistry.checkEngineHealth('PROJECT_FINANCIAL_PROGRAMMING_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ إعداد مشروع وخطة اختبارية عبر المحركات المعنية
  // =========================================================================
  console.log('\n🏗️ 2. إعداد مشروع وخطة هندسية لاختبار البرمجة المالية...');
  let testProject = null;
  let testPlan = null;
  try {
    // مشروع موازنته المعتمدة 100,000 د.أ
    testProject = await projectsEngineService.createProject({
      projectName: 'مشروع إنشاء شبكة تصريف مياه الأمطار في وادي كفرنجة',
      projectType: 'بنية تحتية وشبكات تصريف',
      budgetAmount: 100000.00,
      approvedBudget: 100000.00,
      fundingSource: 'موازنة البلدية والمنح'
    }, adminUser);

    testPlan = await projectPortfolioEngineService.createPlan({
      planName: 'الخطة الاستثمارية متعددة السنوات 2026-2028',
      planType: 'MULTI_YEAR',
      year: 2026,
      description: 'برمجة مشاريع البنية التحتية للأعوام 2026 و 2027 و 2028'
    }, adminUser);

    assert(testProject && testProject.id, 'Test project created with approved budget = 100,000 JD', testProject.project_number);
    assert(testPlan && testPlan.id, 'Test multi-year plan created', testPlan.plan_number);
  } catch (err) {
    assert(false, 'Test data setup failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص التحقق من صحة المراجع (Project & Plan Reference Validation)
  // =========================================================================
  console.log('\n🔍 3. فحص التحقق من صحة مراجع المشروع والخطة...');
  try {
    let invalidProjBlocked = false;
    try {
      await projectFinancialProgrammingEngineService.createFinancialProgram({
        planId: testPlan.id,
        projectId: 'NON-EXISTENT-PROJ',
        fiscalYear: 2026,
        programmedAmount: 20000
      }, adminUser);
    } catch (e) {
      invalidProjBlocked = true;
      assert(true, 'Non-existent project reference strictly blocked', e.message);
    }
    if (!invalidProjBlocked) assert(false, 'Non-existent project was NOT blocked!');

    let invalidPlanBlocked = false;
    try {
      await projectFinancialProgrammingEngineService.createFinancialProgram({
        planId: 'NON-EXISTENT-PLAN',
        projectId: testProject.id,
        fiscalYear: 2026,
        programmedAmount: 20000
      }, adminUser);
    } catch (e) {
      invalidPlanBlocked = true;
      assert(true, 'Non-existent plan reference strictly blocked', e.message);
    }
    if (!invalidPlanBlocked) assert(false, 'Non-existent plan was NOT blocked!');
  } catch (err) {
    assert(false, 'Reference validation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص البرمجة السنوية ومتعددة السنوات وحوكمة سقف الموازنة
  // =========================================================================
  console.log('\n📅 4. فحص البرمجة متعددة السنوات وسقف الموازنة (Budget Ceiling)...');
  let prog2026 = null;
  let prog2027 = null;
  let prog2028 = null;
  try {
    const pId = testProject.id;
    const plId = testPlan.id;

    // أ. مخصص السنة الأولى (2026) = 30,000 د.أ (30%)
    prog2026 = await projectFinancialProgrammingEngineService.createFinancialProgram({
      planId: plId,
      projectId: pId,
      fiscalYear: 2026,
      programmedAmount: 30000.00,
      fundingSource: 'MUNICIPAL_BUDGET',
      notes: 'الدفعة الأولى لأعمال الحفريات وشراء الأنابيب'
    }, adminUser);
    assert(prog2026 && prog2026.id, '2026 allocation created: 30,000 JD');

    // ب. مخصص السنة الثانية (2027) = 50,000 د.أ (50%)
    prog2027 = await projectFinancialProgrammingEngineService.createFinancialProgram({
      planId: plId,
      projectId: pId,
      fiscalYear: 2027,
      programmedAmount: 50000.00,
      fundingSource: 'GOVERNMENT_GRANT',
      notes: 'الدفعة الثانية لأعمال الصب والتركيب الميداني'
    }, adminUser);
    assert(prog2027 && prog2027.id, '2027 allocation created: 50,000 JD');

    // ج. فحص منع تكرار نفس السنة للمشروع في نفس الخطة (Duplicate Year Check)
    let dupYearBlocked = false;
    try {
      await projectFinancialProgrammingEngineService.createFinancialProgram({
        planId: plId,
        projectId: pId,
        fiscalYear: 2026,
        programmedAmount: 10000.00
      }, adminUser);
    } catch (e) {
      dupYearBlocked = true;
      assert(true, 'Duplicate fiscal year allocation for same project strictly blocked', e.message);
    }
    if (!dupYearBlocked) assert(false, 'Duplicate fiscal year was NOT blocked!');

    // د. فحص التحقق من سقف الموازنة (Budget Ceiling Violation Check)
    // المتبقي المسموح: 100k - (30k + 50k) = 20,000 د.أ
    // محاولة برمجة 25,000 د.أ يجب أن تفشل فوراً
    let ceilingViolationBlocked = false;
    try {
      await projectFinancialProgrammingEngineService.createFinancialProgram({
        planId: plId,
        projectId: pId,
        fiscalYear: 2028,
        programmedAmount: 25000.00
      }, adminUser);
    } catch (e) {
      ceilingViolationBlocked = true;
      assert(true, 'Budget ceiling violation strictly blocked (30k + 50k + 25k > 100k)', e.message);
    }
    if (!ceilingViolationBlocked) assert(false, 'Budget ceiling violation was NOT blocked!');

    // هـ. مخصص السنة الثالثة القانوني (2028) = 20,000 د.أ (20%)
    prog2028 = await projectFinancialProgrammingEngineService.createFinancialProgram({
      planId: plId,
      projectId: pId,
      fiscalYear: 2028,
      programmedAmount: 20000.00,
      fundingSource: 'DONOR',
      notes: 'الدفعة النهائية والاستلام الأولي'
    }, adminUser);
    assert(prog2028 && prog2028.id, '2028 allocation created within budget: 20,000 JD');
  } catch (err) {
    assert(false, 'Multi-year programming failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الحسابات التجميعية ونسب البرمجة والمتبقي
  // =========================================================================
  console.log('\n📊 5. فحص الحسابات التجميعية ومؤشرات البرمجة المالية...');
  try {
    const summary = await projectFinancialProgrammingEngineService.calculateProgrammedTotal(testProject.id);
    assert(summary.totalProgrammedAmount === 100000, 'Total programmed amount equals 100,000 JD', `Got: ${summary.totalProgrammedAmount}`);
    assert(summary.remainingBudget === 0, 'Remaining programmable budget equals 0 JD', `Got: ${summary.remainingBudget}`);
    assert(summary.isFullyProgrammed === true && summary.programmingPercentage === 100, 'Project confirmed 100% fully programmed');

    // التحقق من تجميع خطة لسنة 2026
    const plan2026Summary = await projectFinancialProgrammingEngineService.calculateAnnualProgrammedTotal(testPlan.id, 2026);
    assert(plan2026Summary.totalProgrammedAmount === 30000, 'Plan 2026 annual total calculated accurately (30,000 JD)');
  } catch (err) {
    assert(false, 'Financial calculations failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص تعديل وحذف المخصصات المالية
  // =========================================================================
  console.log('\n✏️ 6. فحص تعديل وحذف المخصصات المالية...');
  try {
    // تعديل مخصص 2026
    const updated = await projectFinancialProgrammingEngineService.updateFinancialProgram(prog2026.id, {
      notes: 'تعديل ملاحظات الدفعة الأولى 2026'
    }, adminUser);
    assert(updated.notes === 'تعديل ملاحظات الدفعة الأولى 2026', 'Financial program updated successfully');

    // حذف مخصص 2028
    const delRes = await projectFinancialProgrammingEngineService.deleteFinancialProgram(prog2028.id, adminUser);
    assert(delRes.success === true, 'Financial program 2028 deleted successfully');

    // بعد حذف 2028، المتبقي يجب أن يصبح 20,000 د.أ
    const remAfterDelete = await projectFinancialProgrammingEngineService.calculateRemainingProgramAmount(testProject.id);
    assert(remAfterDelete === 20000, 'Remaining programmable budget accurately recalculated to 20,000 JD after deletion');
  } catch (err) {
    assert(false, 'Update/delete failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 7. فحص استدعاء PROJECT_FINANCIAL_PROGRAMMING_ENGINE عبر EngineOrchestrator...');
  try {
    const orchRes = await engineOrchestrator.invoke(
      'PROJECT_FINANCIAL_PROGRAMMING_ENGINE',
      'calculateProgrammedTotal',
      [testProject.id],
      { user: accountantUser, requiredPermission: 'FINANCIAL_PROGRAM.VIEW' }
    );
    assert(orchRes && orchRes.projectId === testProject.id && orchRes.totalProgrammedAmount === 80000,
      'EngineOrchestrator successfully invoked PROJECT_FINANCIAL_PROGRAMMING_ENGINE.calculateProgrammedTotal');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 8. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('FINANCIAL_PROGRAM.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/financial-programs', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/financial-programs', method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await createGuard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN');
  } catch (err) {
    assert(false, 'Authorization guards failure', err.message);
  }

  // =========================================================================
  // 9️⃣ فحص توثيق سجل التدقيق (Audit Trail Verification)
  // =========================================================================
  console.log('\n📜 9. فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)...');
  try {
    let auditFound = false;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'البرمجة والتخصيص المالي للمشاريع' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'البرمجة والتخصيص المالي للمشاريع');
    }
    assert(auditFound === true, 'Audit log records successfully created for financial programming operations');
  } catch (err) {
    assert(false, 'Audit trail failure', err.message);
  }

  // =========================================================================
  // 🔟 فحص عدم تعديل بيانات المشاريع أو الخطط أو الأولويات الأساسية
  // =========================================================================
  console.log('\n🛡️ 10. فحص سلامة البيانات الأصلية في المحركات الأخرى...');
  try {
    const freshProject = await projectsEngineService.getProjectById(testProject.id);
    assert(parseFloat(freshProject.approved_budget) === 100000,
      'Project master approved budget is completely UNMODIFIED (100,000 JD)');
    assert(freshProject.status === 'DRAFT', 'Project lifecycle status remains unchanged');

    const freshPlan = await projectPortfolioEngineService.getPlanById(testPlan.id);
    assert(freshPlan && freshPlan.plan_name === 'الخطة الاستثمارية متعددة السنوات 2026-2028',
      'Plan master data is completely UNMODIFIED');
  } catch (err) {
    assert(false, 'Data integrity verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك البرمجة والتخصيص المالي (Phase 04-C):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runFinancialProgrammingTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runFinancialProgrammingTestSuite;

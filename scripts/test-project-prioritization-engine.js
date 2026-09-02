/**
 * scripts/test-project-prioritization-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك ترجيح وأولويات المشاريع (PROJECT_PRIORITIZATION_ENGINE Suite — Phase 04-B)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectPrioritizationEngineService = require('../services/projectPrioritizationEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPrioritizationTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('⚖️ بدء الفحص الشامل لمحرك ترجيح وأولويات المشاريع (Phase 04-B)');
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
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل PROJECT_PRIORITIZATION_ENGINE وفحص الجاهزية...');
  try {
    const engineEntry = engineRegistry.get('PROJECT_PRIORITIZATION_ENGINE');
    assert(engineEntry !== undefined, 'PROJECT_PRIORITIZATION_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECT_PRIORITIZATION_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('criteria_weighting'), 'Declared capability: criteria_weighting');

    const health = await engineRegistry.checkEngineHealth('PROJECT_PRIORITIZATION_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_PRIORITIZATION_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص إنشاء معايير الأولوية والتحقق من صحة المدخلات والفرادة
  // =========================================================================
  console.log('\n📐 2. فحص إنشاء معايير التقييم والترجيح والتحقق من القيود...');
  let critSafety = null;
  let critStrategic = null;
  let critUrgency = null;
  try {
    // أ. معيار 1: السلامة المرورية والوقاية (وزن 30، حد أقصى 10)
    critSafety = await projectPrioritizationEngineService.createPriorityCriterion({
      code: 'SAFETY',
      name: 'السلامة المرورية والحد من الحوادث',
      description: 'مدى مساهمة المشروع في معالجة النقاط السوداء وحماية المشاة والسيارات',
      weight: 30.0,
      maxScore: 10.0
    }, adminUser);
    assert(critSafety && critSafety.id, 'Criterion SAFETY created with weight 30.0');

    // ب. معيار 2: الأهمية الاستراتيجية والمجتمعية (وزن 40، حد أقصى 10)
    critStrategic = await projectPrioritizationEngineService.createPriorityCriterion({
      code: 'STRATEGIC_IMPORTANCE',
      name: 'الأهمية الاستراتيجية وخدمة السكان',
      description: 'كثافة المستفيدين وربط الأحياء الرئيسية بمركز البلدية',
      weight: 40.0,
      maxScore: 10.0
    }, adminUser);
    assert(critStrategic && critStrategic.id, 'Criterion STRATEGIC_IMPORTANCE created with weight 40.0');

    // ج. معيار 3: الإلحاح وحالة البنية التحتية (وزن 30، حد أقصى 10)
    critUrgency = await projectPrioritizationEngineService.createPriorityCriterion({
      code: 'URGENCY',
      name: 'درجة التلف والإلحاح الفني',
      description: 'مؤشر وعورة الطريق أو خطورة الجدار القائم',
      weight: 30.0,
      maxScore: 10.0
    }, adminUser);
    assert(critUrgency && critUrgency.id, 'Criterion URGENCY created with weight 30.0');

    // د. فحص منع تكرار نفس الرمز (Unique Code Check)
    let duplicateCodeBlocked = false;
    try {
      await projectPrioritizationEngineService.createPriorityCriterion({
        code: 'SAFETY',
        name: 'تكرار السلامة',
        weight: 10,
        maxScore: 10
      }, adminUser);
    } catch (e) {
      duplicateCodeBlocked = true;
      assert(true, 'Duplicate criterion code SAFETY strictly blocked', e.message);
    }
    if (!duplicateCodeBlocked) assert(false, 'Duplicate criterion code was NOT blocked!');

    // هـ. فحص التحقق من الوزن والحد الأقصى للنقاط (Validation Check)
    let invalidWeightBlocked = false;
    try {
      await projectPrioritizationEngineService.createPriorityCriterion({ code: 'INVALID', name: 'خطأ', weight: -5, maxScore: 10 });
    } catch (e) {
      invalidWeightBlocked = true;
      assert(true, 'Negative weight strictly blocked', e.message);
    }
    if (!invalidWeightBlocked) assert(false, 'Negative weight was NOT blocked!');

    let invalidMaxScoreBlocked = false;
    try {
      await projectPrioritizationEngineService.createPriorityCriterion({ code: 'INVALID2', name: 'خطأ', weight: 10, maxScore: 0 });
    } catch (e) {
      invalidMaxScoreBlocked = true;
      assert(true, 'Zero or negative max_score strictly blocked', e.message);
    }
    if (!invalidMaxScoreBlocked) assert(false, 'Zero max_score was NOT blocked!');
  } catch (err) {
    assert(false, 'Criteria creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص تعطيل وتفعيل المعايير (Activation & Deactivation)
  // =========================================================================
  console.log('\n⚙️ 3. فحص تفعيل وتعطيل معايير التقييم...');
  try {
    const deactRes = await projectPrioritizationEngineService.deactivatePriorityCriterion(critUrgency.id, adminUser);
    assert(deactRes.success === true, 'Criterion URGENCY deactivated successfully');

    const checkDeactivated = await projectPrioritizationEngineService.getPriorityCriterionById(critUrgency.id);
    assert(checkDeactivated.active === false, 'Criterion status reflected as inactive');

    const actRes = await projectPrioritizationEngineService.activatePriorityCriterion(critUrgency.id, adminUser);
    assert(actRes.success === true, 'Criterion URGENCY reactivated successfully');

    const checkActivated = await projectPrioritizationEngineService.getPriorityCriterionById(critUrgency.id);
    assert(checkActivated.active === true, 'Criterion status reflected as active');
  } catch (err) {
    assert(false, 'Activation/deactivation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ إنشاء مشاريع تجريبية عبر PROJECTS_ENGINE دون المساس بالبيانات
  // =========================================================================
  console.log('\n🏗️ 4. إنشاء مشاريع هندسية عبر PROJECTS_ENGINE لإجراء التقييم...');
  let projectAlpha = null;
  let projectBeta = null;
  let projectGamma = null;
  try {
    projectAlpha = await projectsEngineService.createProject({
      projectName: 'مشروع صيانة وتأهيل طريق الساخنة الرئيسي',
      projectType: 'صيانة طرق',
      budgetAmount: 60000.00,
      approvedBudget: 60000.00
    }, adminUser);

    projectBeta = await projectsEngineService.createProject({
      projectName: 'مشروع إنشاء جدار استنادي وحماية مقبرة كفرنجة',
      projectType: 'جدران استنادية',
      budgetAmount: 35000.00,
      approvedBudget: 35000.00
    }, adminUser);

    projectGamma = await projectsEngineService.createProject({
      projectName: 'مشروع تجميل وتوسعة مدخل المدينة الشرقي',
      projectType: 'تجميل وتوسعة',
      budgetAmount: 25000.00,
      approvedBudget: 25000.00
    }, adminUser);

    assert(projectAlpha && projectBeta && projectGamma, 'Test projects created in PROJECTS_ENGINE successfully');
  } catch (err) {
    assert(false, 'Test projects setup failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص تسجيل النقاط واحتساب الدرجات الموزونة (Scoring & Weighting)
  // =========================================================================
  console.log('\n🎯 5. فحص تسجيل النقاط واحتساب الدرجات الموزونة رياضياً...');
  try {
    // أ. فحص رفض التقييم لمشروع غير موجود
    let nonExistentProjBlocked = false;
    try {
      await projectPrioritizationEngineService.setProjectCriterionScore('NON-EXISTENT-PROJ-ID', critSafety.id, 8, '', adminUser);
    } catch (e) {
      nonExistentProjBlocked = true;
      assert(true, 'Scoring non-existent project strictly blocked', e.message);
    }
    if (!nonExistentProjBlocked) assert(false, 'Scoring non-existent project was NOT blocked!');

    // ب. فحص رفض درجة خارج النطاق (Score > max_score)
    let outOfRangeBlocked = false;
    try {
      await projectPrioritizationEngineService.setProjectCriterionScore(projectAlpha.id, critSafety.id, 15, '', adminUser);
    } catch (e) {
      outOfRangeBlocked = true;
      assert(true, 'Score exceeding max_score (15 > 10) strictly blocked', e.message);
    }
    if (!outOfRangeBlocked) assert(false, 'Out of range score was NOT blocked!');

    // ج. تسجيل نقاط المشروع Alpha:
    // Safety: 8/10 * 30 = 24.0
    // Strategic: 9/10 * 40 = 36.0
    // Urgency: 7/10 * 30 = 21.0
    // Total Expected = 24 + 36 + 21 = 81.0
    await projectPrioritizationEngineService.setProjectCriterionScore(projectAlpha.id, critSafety.id, 8, 'مستوى سلامة متوسط', adminUser);
    await projectPrioritizationEngineService.setProjectCriterionScore(projectAlpha.id, critStrategic.id, 9, 'طريق حيوي جداً', adminUser);
    const alphaScoreRes = await projectPrioritizationEngineService.setProjectCriterionScore(projectAlpha.id, critUrgency.id, 7, 'هبوطات إسفلتية', adminUser);

    assert(alphaScoreRes.totalResult.total_score === 81,
      'Project Alpha total score accurately calculated as 81.0', `Got: ${alphaScoreRes.totalResult.total_score}`);

    // د. تسجيل نقاط المشروع Beta:
    // Safety: 10/10 * 30 = 30.0
    // Strategic: 8/10 * 40 = 32.0
    // Urgency: 10/10 * 30 = 30.0
    // Total Expected = 30 + 32 + 30 = 92.0
    await projectPrioritizationEngineService.setProjectCriterionScore(projectBeta.id, critSafety.id, 10, 'خطر انهيار وشيك', adminUser);
    await projectPrioritizationEngineService.setProjectCriterionScore(projectBeta.id, critStrategic.id, 8, 'حماية موقع عام', adminUser);
    const betaScoreRes = await projectPrioritizationEngineService.setProjectCriterionScore(projectBeta.id, critUrgency.id, 10, 'إلحاح قصوى', adminUser);

    assert(betaScoreRes.totalResult.total_score === 92,
      'Project Beta total score accurately calculated as 92.0', `Got: ${betaScoreRes.totalResult.total_score}`);

    // هـ. تسجيل نقاط المشروع Gamma (نقاط مساوية لـ Alpha لاختبار الترتيب الحتمي):
    // Safety: 8/10 * 30 = 24.0, Strategic: 9/10 * 40 = 36.0, Urgency: 7/10 * 30 = 21.0 -> Total = 81.0
    await projectPrioritizationEngineService.setProjectCriterionScore(projectGamma.id, critSafety.id, 8, '', adminUser);
    await projectPrioritizationEngineService.setProjectCriterionScore(projectGamma.id, critStrategic.id, 9, '', adminUser);
    const gammaScoreRes = await projectPrioritizationEngineService.setProjectCriterionScore(projectGamma.id, critUrgency.id, 7, '', adminUser);

    assert(gammaScoreRes.totalResult.total_score === 81,
      'Project Gamma total score accurately calculated as 81.0 (Equal to Alpha)', `Got: ${gammaScoreRes.totalResult.total_score}`);
  } catch (err) {
    assert(false, 'Project scoring failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص توليد الترتيب الحتمي (Deterministic Ranking)
  // =========================================================================
  console.log('\n🏆 6. فحص ترتيب المشاريع وفق الأولويات (Deterministic Ranking)...');
  try {
    const ranking = await projectPrioritizationEngineService.rankProjects();
    assert(Array.isArray(ranking) && ranking.length >= 3, 'Ranking generated with all evaluated projects');

    // المشروع Beta أعلى درجة (92) يجب أن يكون Rank 1
    assert(ranking[0].projectId === projectBeta.id && ranking[0].rank === 1 && ranking[0].totalScore === 92,
      'Project Beta ranked #1 with top score (92.0)');

    // المشاريع ذات الدرجات المتساوية (Alpha و Gamma برصيد 81) رُتبت حتمياً بالمعرف ASC
    const tiedProjects = ranking.slice(1, 3);
    assert(tiedProjects[0].totalScore === 81 && tiedProjects[1].totalScore === 81, 'Tied projects have identical total scores (81.0)');
    assert(tiedProjects[0].rank === 2 && tiedProjects[1].rank === 3, 'Ranks assigned sequentially without gaps (Rank 2 and Rank 3)');
  } catch (err) {
    assert(false, 'Ranking verification failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص الاستدعاء عبر منسق المحركات (Engine Orchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 7. فحص استدعاء PROJECT_PRIORITIZATION_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'PROJECT_PRIORITIZATION_ENGINE',
      'getProjectPriority',
      [projectBeta.id],
      { user: adminUser, requiredPermission: 'PROJECT_PRIORITY.VIEW' }
    );
    assert(orchResult && orchResult.projectId === projectBeta.id && orchResult.totalScore === 92,
      'EngineOrchestrator successfully invoked PROJECT_PRIORITIZATION_ENGINE.getProjectPriority');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 8. فحص حراس الصلاحيات والأمان على مسارات الأولويات...');
  try {
    const manageGuard = rbacManager.requirePermission('PROJECT_PRIORITY.MANAGE');

    // أ. فحص 401 لطلب غير موثق
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: `/api/project-priority/projects/${projectAlpha.id}/scores`, method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await manageGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403 لمستخدم غير مصرح له
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: `/api/project-priority/projects/${projectAlpha.id}/scores`, method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await manageGuard(reqForbidden, res403, () => {});
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'ترجيح وأولويات المشاريع' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'ترجيح وأولويات المشاريع');
    }
    assert(auditFound === true, 'Audit log records successfully created for prioritization operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  // =========================================================================
  // 🔟 فحص عدم تعديل أو تشويه البيانات الأساسية للمشروع (Master Data Safety)
  // =========================================================================
  console.log('\n🛡️ 10. فحص الحفاظ الكامل على سلامة بيانات المشاريع في PROJECTS_ENGINE...');
  try {
    const freshAlpha = await projectsEngineService.getProjectById(projectAlpha.id);
    assert(freshAlpha && freshAlpha.project_name === 'مشروع صيانة وتأهيل طريق الساخنة الرئيسي',
      'Project master data (name, budget, status) is completely INTACT and unmodified');
    assert(freshAlpha.status === 'DRAFT', 'Project lifecycle status remains standard and unchanged by prioritization engine');
  } catch (err) {
    assert(false, 'Master data safety verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك ترجيح وأولويات المشاريع (Phase 04-B):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPrioritizationTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPrioritizationTestSuite;

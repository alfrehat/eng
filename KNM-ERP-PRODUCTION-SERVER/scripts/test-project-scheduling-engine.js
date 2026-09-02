/**
 * scripts/test-project-scheduling-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك الجدولة الزمنية وحسابات المسار الحرج (Phase 04-E Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectSchedulingEngineService = require('../services/projectSchedulingEngineService');
const projectDependencyEngineService = require('../services/projectDependencyEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runSchedulingTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('⏱️ بدء الفحص الشامل لمحرك الجدولة الزمنية والمسار الحرج CPM (Phase 04-E)');
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
  console.log('📋 1. فحص تسجيل PROJECT_SCHEDULING_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('PROJECT_SCHEDULING_ENGINE');
    assert(engineEntry !== undefined, 'PROJECT_SCHEDULING_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECT_SCHEDULING_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('cpm_calculation'), 'Declared capability: cpm_calculation');
    assert(engineEntry && engineEntry.capabilities.includes('critical_path_analysis'), 'Declared capability: critical_path_analysis');

    const health = await engineRegistry.checkEngineHealth('PROJECT_SCHEDULING_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_SCHEDULING_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ إعداد شبكة مشاريع نموذجية لاختبار المسار الحرج (CPM Network Setup)
  // =========================================================================
  console.log('\n🏗️ 2. إنشاء شبكة مشاريع هندسية متكاملة لاختبار خوارزمية المسار الحرج...');
  let pFoundation = null;
  let pStructure = null;
  let pSurvey = null;
  let pHandover = null;
  try {
    // المشروع 1: الأساسات (10 أيام) من 2026-09-01 إلى 2026-09-10
    pFoundation = await projectsEngineService.createProject({
      projectName: 'المشروع 1 - أعمال حفر وصب الأساسات الخرسانية',
      projectType: 'أساسات خرسانية',
      budgetAmount: 40000.00,
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2026-09-10'
    }, adminUser);

    // المشروع 2: الهيكل الإنشائي (20 يوماً) من 2026-09-11 إلى 2026-09-30
    pStructure = await projectsEngineService.createProject({
      projectName: 'المشروع 2 - أعمال الهيكل الإنشائي والجدران',
      projectType: 'هيكل إنشائي',
      budgetAmount: 60000.00,
      plannedStartDate: '2026-09-11',
      plannedEndDate: '2026-09-30'
    }, adminUser);

    // المشروع 3: مسار جانبي (5 أيام) من 2026-09-01 إلى 2026-09-05 (Parallel Path with Float)
    pSurvey = await projectsEngineService.createProject({
      projectName: 'المشروع 3 - مسح وتوثيق السلامة المرورية',
      projectType: 'دراسات ومسح',
      budgetAmount: 10000.00,
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2026-09-05'
    }, adminUser);

    // المشروع 4: التسليم النهائي (10 أيام) من 2026-10-01 إلى 2026-10-10
    pHandover = await projectsEngineService.createProject({
      projectName: 'المشروع 4 - الفحص الفني والاستلام الأولي',
      projectType: 'تسليم واستلام',
      budgetAmount: 15000.00,
      plannedStartDate: '2026-10-01',
      plannedEndDate: '2026-10-10'
    }, adminUser);

    assert(pFoundation && pStructure && pSurvey && pHandover, 'All 4 test projects created with planned calendar dates');

    // إنشاء العلاقات الهندسية:
    // Foundation ➔ Structure (FS, lag = 0)
    await projectDependencyEngineService.createDependency({
      predecessorProjectId: pFoundation.id,
      successorProjectId: pStructure.id,
      dependencyType: 'FS',
      lagDays: 0
    }, adminUser);

    // Structure ➔ Handover (FS, lag = 0)
    await projectDependencyEngineService.createDependency({
      predecessorProjectId: pStructure.id,
      successorProjectId: pHandover.id,
      dependencyType: 'FS',
      lagDays: 0
    }, adminUser);

    // Survey ➔ Handover (FS, lag = 0)
    await projectDependencyEngineService.createDependency({
      predecessorProjectId: pSurvey.id,
      successorProjectId: pHandover.id,
      dependencyType: 'FS',
      lagDays: 0
    }, adminUser);

    console.log('   🔗 Dependency Network established: [Foundation ➔ Structure ➔ Handover] and [Survey ➔ Handover]');
  } catch (err) {
    assert(false, 'Network setup failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص خوارزمية المسار الحرج (Forward & Backward Pass / Float / CPM)
  // =========================================================================
  console.log('\n🧮 3. فحص خوارزمية المسار الحرج (Forward/Backward Pass, Float, Critical Path)...');
  try {
    const cpmResult = await projectSchedulingEngineService.calculateNetworkCPM({}, adminUser);
    assert(cpmResult.success === true, 'CPM Network calculation executed successfully');
    assert(cpmResult.totalProjects >= 4, 'Total projects evaluated in CPM network >= 4');

    const schedMap = new Map();
    cpmResult.schedules.forEach(s => schedMap.set(s.project_id, s));

    const sFound = schedMap.get(pFoundation.id);
    const sStruct = schedMap.get(pStructure.id);
    const sSurvey = schedMap.get(pSurvey.id);
    const sHand = schedMap.get(pHandover.id);

    // أ. فحص التمرير الأمامي للمشروع الأساسي
    assert(sFound && sFound.duration_days === 10, 'Foundation duration accurately calculated as 10 days');
    assert(sStruct && sStruct.duration_days === 20, 'Structure duration accurately calculated as 20 days');

    // ب. فحص التمرير الخلفي والطفو الزمني (Float)
    // المسار الحرج هو: Foundation (10d) ➔ Structure (20d) ➔ Handover (10d) = 40 days total (Float = 0)
    assert(sFound.is_critical === true && sFound.total_float_days === 0, 'Foundation is on CRITICAL PATH (Total Float = 0)');
    assert(sStruct.is_critical === true && sStruct.total_float_days === 0, 'Structure is on CRITICAL PATH (Total Float = 0)');
    assert(sHand.is_critical === true && sHand.total_float_days === 0, 'Handover is on CRITICAL PATH (Total Float = 0)');

    // المسار الموازي (Survey): مدته 5 أيام فقط وينتهي قبل Handover بفارق كبير => Total Float > 0
    assert(sSurvey.is_critical === false && sSurvey.total_float_days > 0,
      `Survey has positive float (${sSurvey.total_float_days} days) and is NOT on critical path`);

    // ج. فحص استرجاع قائمة المسار الحرج
    const critRes = await projectSchedulingEngineService.getCriticalPath({});
    assert(critRes.criticalPath.length >= 3, 'Critical path filter returns all critical projects in network');
    const critIds = critRes.criticalPath.map(c => c.project_id);
    assert(critIds.includes(pFoundation.id) && critIds.includes(pStructure.id) && critIds.includes(pHandover.id),
      'Critical path contains Foundation, Structure, and Handover');
    assert(!critIds.includes(pSurvey.id), 'Critical path excludes non-critical Survey project');
  } catch (err) {
    assert(false, 'CPM calculations failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص كشف التعارضات والانحرافات الزمنية (Conflict Detection)
  // =========================================================================
  console.log('\n⚠️ 4. فحص كشف التعارضات والانحرافات الزمنية (Conflict Detection)...');
  try {
    // إنشاء مشروعين متعارضين عمداً:
    // المشروع X ينتهي في 2026-11-20
    // المشروع Y يبدأ في 2026-11-10 (أسبق من انتهاء السابق ولديهما علاقة FS)
    const pConfA = await projectsEngineService.createProject({
      projectName: 'مشروع متعارض سابق',
      projectType: 'طرق',
      plannedStartDate: '2026-11-01',
      plannedEndDate: '2026-11-20'
    }, adminUser);

    const pConfB = await projectsEngineService.createProject({
      projectName: 'مشروع متعارض لاحق',
      projectType: 'إنارة',
      plannedStartDate: '2026-11-10', // تعارض!
      plannedEndDate: '2026-11-25'
    }, adminUser);

    await projectDependencyEngineService.createDependency({
      predecessorProjectId: pConfA.id,
      successorProjectId: pConfB.id,
      dependencyType: 'FS',
      lagDays: 0
    }, adminUser);

    const conflictReport = await projectSchedulingEngineService.detectScheduleConflicts();
    assert(conflictReport.hasConflicts === true, 'Schedule conflict detected accurately');
    const targetConflict = conflictReport.conflicts.find(c => c.predecessorId === pConfA.id && c.successorId === pConfB.id);
    assert(targetConflict !== undefined, 'Target planned date violation accurately identified with reason');
  } catch (err) {
    assert(false, 'Conflict detection failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الخط المرجعي للجدول الزمني (Schedule Baseline Management)
  // =========================================================================
  console.log('\n📐 5. فحص إنشاء وتثبيت الخط المرجعي (Schedule Baseline)...');
  try {
    const bslRes = await projectSchedulingEngineService.createScheduleBaseline(pStructure.id, adminUser);
    assert(bslRes.success === true && bslRes.baseline.schedule_version === 'BASELINE',
      'Schedule baseline successfully created with version BASELINE');

    const bslData = await projectSchedulingEngineService.getScheduleBaseline(pStructure.id);
    assert(bslData && bslData.schedule && bslData.schedule.is_baseline === true,
      'Schedule baseline retrieved successfully and marked is_baseline = true');
  } catch (err) {
    assert(false, 'Baseline management failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 6. فحص استدعاء PROJECT_SCHEDULING_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'PROJECT_SCHEDULING_ENGINE',
      'getProjectSchedule',
      [pFoundation.id, 'v1.0'],
      { user: engineerUser, requiredPermission: 'PROJECT_SCHEDULE.VIEW' }
    );
    assert(orchResult && orchResult.projectId === pFoundation.id && orchResult.schedule.duration_days === 10,
      'EngineOrchestrator successfully invoked PROJECT_SCHEDULING_ENGINE.getProjectSchedule');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 7. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const calcGuard = rbacManager.requirePermission('PROJECT_SCHEDULE.CALCULATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/project-schedules/network/calculate', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await calcGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/project-schedules/network/calculate', method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await calcGuard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN');
  } catch (err) {
    assert(false, 'Authorization guards failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)
  // =========================================================================
  console.log('\n📜 8. فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)...');
  try {
    let auditFound = false;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'الجدولة الزمنية والمسار الحرج' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'الجدولة الزمنية والمسار الحرج');
    }
    assert(auditFound === true, 'Audit log records successfully created for scheduling operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  // =========================================================================
  // 9️⃣ فحص سلامة البيانات الأصلية وعدم تشويه بيانات المشاريع
  // =========================================================================
  console.log('\n🛡️ 9. فحص سلامة البيانات الأصلية في المحركات الأخرى...');
  try {
    const freshFoundation = await projectsEngineService.getProjectById(pFoundation.id);
    assert(freshFoundation && parseFloat(freshFoundation.budget_amount) === 40000,
      'Project master budget and core fields are completely UNMODIFIED (40,000 JD)');
    assert(freshFoundation.status === 'DRAFT', 'Project lifecycle status remains standard and intact');
  } catch (err) {
    assert(false, 'Master data safety failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك الجدولة الزمنية والمسار الحرج (Phase 04-E):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runSchedulingTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runSchedulingTestSuite;

/**
 * scripts/test-project-dependency-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك شبكة واعتماديات تتابع المشاريع (Phase 04-D Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectDependencyEngineService = require('../services/projectDependencyEngineService');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runDependencyTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔗 بدء الفحص الشامل لمحرك شبكة واعتماديات تتابع المشاريع (Phase 04-D)');
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
  console.log('📋 1. فحص تسجيل PROJECT_DEPENDENCY_ENGINE وفحص الجاهزية التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('PROJECT_DEPENDENCY_ENGINE');
    assert(engineEntry !== undefined, 'PROJECT_DEPENDENCY_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECT_DEPENDENCY_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('cycle_detection'), 'Declared capability: cycle_detection');
    assert(engineEntry && engineEntry.capabilities.includes('readiness_validation'), 'Declared capability: readiness_validation');

    const health = await engineRegistry.checkEngineHealth('PROJECT_DEPENDENCY_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECT_DEPENDENCY_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ إعداد مشاريع اختبارية عبر PROJECTS_ENGINE
  // =========================================================================
  console.log('\n🏗️ 2. إنشاء مشاريع هندسية لاختبار شبكة التتابع والأسبقية...');
  let projectA = null;
  let projectB = null;
  let projectC = null;
  let projectD = null;
  try {
    projectA = await projectsEngineService.createProject({
      projectName: 'المشروع أ - أعمال دراسات وفحوصات التربة والمساحة',
      projectType: 'دراسات هندسية',
      budgetAmount: 15000.00
    }, adminUser);

    projectB = await projectsEngineService.createProject({
      projectName: 'المشروع ب - أعمال الحفريات وتجهيز البنية التحتية',
      projectType: 'حفريات وتجهيز',
      budgetAmount: 45000.00
    }, adminUser);

    projectC = await projectsEngineService.createProject({
      projectName: 'المشروع ج - أعمال التعبيد والخلطات الإسفلتية النهائية',
      projectType: 'تعبيد طرق',
      budgetAmount: 70000.00
    }, adminUser);

    projectD = await projectsEngineService.createProject({
      projectName: 'المشروع د - تركيب الشواخص والإنارة الذكية',
      projectType: 'إنارة وشواخص',
      budgetAmount: 20000.00
    }, adminUser);

    assert(projectA && projectB && projectC && projectD, 'Test projects A, B, C, D created successfully');
  } catch (err) {
    assert(false, 'Test projects setup failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص قواعد التحقق والمنع (Validation: Self, Duplicates, References, Lag)
  // =========================================================================
  console.log('\n🛑 3. فحص قواعد التحقق والمنع الصارم (Self-dependency, Duplicates, References)...');
  try {
    // أ. منع الاعتمادية الذاتية (Self-Dependency)
    let selfDepBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectA.id,
        successorProjectId: projectA.id,
        dependencyType: 'FS'
      }, adminUser);
    } catch (e) {
      selfDepBlocked = true;
      assert(true, 'Self-dependency strictly blocked (A -> A)', e.message);
    }
    if (!selfDepBlocked) assert(false, 'Self-dependency was NOT blocked!');

    // ب. رفض مشروع سابق غير موجود
    let nonExistentPredBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: 'NON-EXISTENT-PRED',
        successorProjectId: projectB.id,
        dependencyType: 'FS'
      }, adminUser);
    } catch (e) {
      nonExistentPredBlocked = true;
      assert(true, 'Non-existent predecessor strictly blocked', e.message);
    }
    if (!nonExistentPredBlocked) assert(false, 'Non-existent predecessor was NOT blocked!');

    // ج. رفض مشروع لاحق غير موجود
    let nonExistentSuccBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectA.id,
        successorProjectId: 'NON-EXISTENT-SUCC',
        dependencyType: 'FS'
      }, adminUser);
    } catch (e) {
      nonExistentSuccBlocked = true;
      assert(true, 'Non-existent successor strictly blocked', e.message);
    }
    if (!nonExistentSuccBlocked) assert(false, 'Non-existent successor was NOT blocked!');

    // د. فحص منع lag_days < 0
    let invalidLagBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectA.id,
        successorProjectId: projectB.id,
        dependencyType: 'FS',
        lagDays: -5
      }, adminUser);
    } catch (e) {
      invalidLagBlocked = true;
      assert(true, 'Negative lag_days strictly blocked', e.message);
    }
    if (!invalidLagBlocked) assert(false, 'Negative lag_days was NOT blocked!');
  } catch (err) {
    assert(false, 'Validation checks failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص إنشاء العلاقات الأربعة (FS, SS, FF, SF) وتخزينها
  // =========================================================================
  console.log('\n🔗 4. فحص إنشاء العلاقات الأربعة (FS, SS, FF, SF)...');
  let depAB_FS = null;
  let depBC_SS = null;
  let depCD_FF = null;
  let depAD_SF = null;
  try {
    // أ. علاقة FS: A -> B (الحفريات لا تبدأ إلا بعد انتهاء الدراسات)
    depAB_FS = await projectDependencyEngineService.createDependency({
      predecessorProjectId: projectA.id,
      successorProjectId: projectB.id,
      dependencyType: 'FS',
      lagDays: 3,
      notes: 'Finish-to-Start مع فترة سماح 3 أيام'
    }, adminUser);
    assert(depAB_FS && depAB_FS.id && depAB_FS.dependency_type === 'FS', 'FS Dependency created (A ➔ B)');

    // ب. علاقة SS: B -> C (التعبيد يبدأ بعد بدء الحفريات)
    depBC_SS = await projectDependencyEngineService.createDependency({
      predecessorProjectId: projectB.id,
      successorProjectId: projectC.id,
      dependencyType: 'SS',
      lagDays: 5,
      notes: 'Start-to-Start'
    }, adminUser);
    assert(depBC_SS && depBC_SS.id && depBC_SS.dependency_type === 'SS', 'SS Dependency created (B ➔ C)');

    // ج. علاقة FF: C -> D (الإنارة تنتهي مع انتهاء التعبيد)
    depCD_FF = await projectDependencyEngineService.createDependency({
      predecessorProjectId: projectC.id,
      successorProjectId: projectD.id,
      dependencyType: 'FF',
      lagDays: 0,
      notes: 'Finish-to-Finish'
    }, adminUser);
    assert(depCD_FF && depCD_FF.id && depCD_FF.dependency_type === 'FF', 'FF Dependency created (C ➔ D)');

    // د. فحص منع تكرار نفس العلاقة (Duplicate Pair Check)
    let duplicateBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectA.id,
        successorProjectId: projectB.id,
        dependencyType: 'SS'
      }, adminUser);
    } catch (e) {
      duplicateBlocked = true;
      assert(true, 'Duplicate dependency pair strictly blocked (A ➔ B again)', e.message);
    }
    if (!duplicateBlocked) assert(false, 'Duplicate dependency pair was NOT blocked!');
  } catch (err) {
    assert(false, 'Relationship creation failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص كشف ومنع التبعيات الدائرية (Cycle Detection - DAG Traversal)
  // =========================================================================
  console.log('\n🔄 5. فحص كشف ومنع التبعيات الدائرية والحلقات المغلقة (Cycle Detection)...');
  try {
    // لدينا حالياً المسار: A ➔ B ➔ C ➔ D
    // محاولة إنشاء D ➔ A يجب أن تُكشف كحلقة مغلقة (D -> A -> B -> C -> D) وتُرفض فوراً
    let directCycleBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectD.id,
        successorProjectId: projectA.id,
        dependencyType: 'FS'
      }, adminUser);
    } catch (e) {
      directCycleBlocked = true;
      assert(true, 'Multi-node cycle strictly BLOCKED (D ➔ A creating D ➔ A ➔ B ➔ C ➔ D)', e.message);
    }
    if (!directCycleBlocked) assert(false, 'Multi-node cycle was NOT blocked!');

    // محاولة إنشاء B ➔ A (حلقة ثنائية A ➔ B ➔ A) يجب أن تُرفض فوراً
    let twoNodeCycleBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: projectB.id,
        successorProjectId: projectA.id,
        dependencyType: 'FS'
      }, adminUser);
    } catch (e) {
      twoNodeCycleBlocked = true;
      assert(true, 'Two-node direct cycle strictly BLOCKED (B ➔ A creating A ➔ B ➔ A)', e.message);
    }
    if (!twoNodeCycleBlocked) assert(false, 'Two-node cycle was NOT blocked!');
  } catch (err) {
    assert(false, 'Cycle detection failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص الجاهزية والانسداد (Read-Only Readiness Validation)
  // =========================================================================
  console.log('\n🚦 6. فحص الجاهزية والانسداد (Read-Only Readiness Validation)...');
  try {
    // أ. المشروع A ليس له أي سابق => يجب أن يكون READY
    const readyA = await projectDependencyEngineService.validateProjectReadiness(projectA.id);
    assert(readyA.readinessStatus === 'READY' && readyA.isReady === true && readyA.blockersCount === 0,
      'Project A with NO predecessors is READY to proceed');

    // ب. المشروع B يعتمد على A عبر FS وحالة A الحالية DRAFT (غير مكتمل) => يجب أن يكون BLOCKED
    const readyB_Initial = await projectDependencyEngineService.validateProjectReadiness(projectB.id);
    assert(readyB_Initial.readinessStatus === 'BLOCKED' && readyB_Initial.isReady === false && readyB_Initial.blockersCount === 1,
      'Project B is BLOCKED because predecessor A is not completed (DRAFT)');

    // ج. تحديث حالة المشروع A إلى COMPLETED وفحص جاهزية B مجدداً
    if (isPostgresActive()) {
      await require('../utils/database').dbRun("UPDATE public.projects SET status = 'COMPLETED' WHERE id = $1", [projectA.id]);
    } else {
      const idx = (memDb.projects || []).findIndex(p => p.id === projectA.id);
      if (idx !== -1) memDb.projects[idx].status = 'COMPLETED';
    }

    const readyB_After = await projectDependencyEngineService.validateProjectReadiness(projectB.id);
    assert(readyB_After.readinessStatus === 'READY' && readyB_After.isReady === true && readyB_After.blockersCount === 0,
      'Project B becomes READY after predecessor A transitioned to COMPLETED');

    // د. التأكد من أن validateProjectReadiness لم يغير حالة المشروع B في قاعدة البيانات
    const freshB = await projectsEngineService.getProjectById(projectB.id);
    assert(freshB.status === 'DRAFT', 'Project B database status remains DRAFT (Readiness check is strictly READ-ONLY)');
  } catch (err) {
    assert(false, 'Readiness validation failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص المخطط الهيكلي للشبكة والاستدعاء عبر منسق المحركات
  // =========================================================================
  console.log('\n🕸️ 7. فحص مخطط الشبكة (Dependency Graph) والاستدعاء عبر Orchestrator...');
  try {
    const graph = await projectDependencyEngineService.getDependencyGraph();
    assert(graph.nodesCount >= 4 && graph.edgesCount >= 3, 'Dependency graph generated with valid nodes and edges');

    const orchResult = await engineOrchestrator.invoke(
      'PROJECT_DEPENDENCY_ENGINE',
      'validateProjectReadiness',
      [projectB.id],
      { user: engineerUser, requiredPermission: 'PROJECT_DEPENDENCY.VIEW' }
    );
    assert(orchResult && orchResult.readinessStatus === 'READY',
      'EngineOrchestrator successfully invoked PROJECT_DEPENDENCY_ENGINE.validateProjectReadiness');
  } catch (err) {
    assert(false, 'Graph & Orchestrator verification failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 8. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('PROJECT_DEPENDENCY.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/project-dependencies', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/project-dependencies', method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await createGuard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN');
  } catch (err) {
    assert(false, 'Authorization guards failure', err.message);
  }

  // =========================================================================
  // 9️⃣ فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)
  // =========================================================================
  console.log('\n📜 9. فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)...');
  try {
    let auditFound = false;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'اعتماديات وتتابع المشاريع' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'اعتماديات وتتابع المشاريع');
    }
    assert(auditFound === true, 'Audit log records successfully created for dependency operations');
  } catch (err) {
    assert(false, 'Audit trail failure', err.message);
  }

  // =========================================================================
  // 🔟 فحص سلامة البيانات عند حذف الاعتمادية (Data Integrity on Deletion)
  // =========================================================================
  console.log('\n🛡️ 10. فحص سلامة المشاريع عند حذف علاقة اعتمادية...');
  try {
    const delRes = await projectDependencyEngineService.deleteDependency(depCD_FF.id, adminUser);
    assert(delRes.success === true, 'Dependency C ➔ D deleted successfully');

    const freshC = await projectsEngineService.getProjectById(projectC.id);
    const freshD = await projectsEngineService.getProjectById(projectD.id);
    assert(freshC && freshD && freshC.id === projectC.id && freshD.id === projectD.id,
      'Predecessor and successor project master records remain completely INTACT after dependency deletion');
  } catch (err) {
    assert(false, 'Data integrity verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك شبكة واعتماديات المشاريع (Phase 04-D):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runDependencyTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runDependencyTestSuite;

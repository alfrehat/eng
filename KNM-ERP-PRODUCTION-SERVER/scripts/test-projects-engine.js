/**
 * scripts/test-projects-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك المشاريع الهندسية (PROJECTS_ENGINE Suite — Phase 03)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const projectsEngineService = require('../services/projectsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runProjectsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏗️  بدء الفحص الشامل لمحرك المشاريع الهندسية والمحافظ الرأسمالية (Phase 03)');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
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

  // =========================================================================
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل PROJECTS_ENGINE وفحص الصحة التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('PROJECTS_ENGINE');
    assert(engineEntry !== undefined, 'PROJECTS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PROJECTS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('project_aggregate'), 'PROJECTS_ENGINE declares project_aggregate capability');

    const health = await engineRegistry.checkEngineHealth('PROJECTS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PROJECTS_ENGINE health check passed with status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص الترقيم الذري وإنشاء المشروع (Project Numbering & Creation)
  // =========================================================================
  console.log('\n🔢 2. فحص الترقيم التلقائي وإنشاء المشروع الهندسي (PRJ-YYYY-XXXX)...');
  let createdProject = null;
  try {
    const adminUser = { id: 'U-001', username: 'admin', fullName: 'مدير النظام', role: 'admin' };
    const projectData = {
      projectName: 'مشروع تأهيل وتعبيد شوارع منطقة كفرنجة الرئيسية',
      projectType: 'تعبيد وصيانة طرق',
      description: 'إعادة إنشاء وتعبيد طبقة إسفلتية بطول 3.5 كم مع أعمال تصريف مياه الأمطار',
      budgetAmount: 120000.00,
      approvedBudget: 120000.00,
      fundingSource: 'موازنة البلدية 2026',
      location: 'كفرنجة - الشارع الرئيسي ومحيط البلدية',
      latitude: 32.2985,
      longitude: 35.7925
    };

    createdProject = await projectsEngineService.createProject(projectData, adminUser);
    assert(createdProject && createdProject.id, 'Project created successfully');
    assert(createdProject.project_number.startsWith('PRJ-'), 'Project number follows atomic numbering scheme', createdProject.project_number);
    assert(createdProject.status === 'DRAFT', 'New project starts in DRAFT lifecycle state');
  } catch (err) {
    assert(false, 'Project creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص حوكمة دورة الحياة وقواعد الانتقال (Lifecycle State Machine)
  // =========================================================================
  console.log('\n🔄 3. فحص دورة حياة المشروع وانتقال الحالات (Lifecycle Transitions)...');
  try {
    const pId = createdProject.id;
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin' };

    // أ. انتقال صحيح: DRAFT -> SUBMITTED
    const step1 = await projectsEngineService.transitionStatus(pId, 'SUBMITTED', adminUser, 'تقديم مسودة المشروع');
    assert(step1.success && step1.currentStatus === 'SUBMITTED', 'Valid transition: DRAFT ➔ SUBMITTED');

    // ب. انتقال صحيح: SUBMITTED -> UNDER_REVIEW
    const step2 = await projectsEngineService.transitionStatus(pId, 'UNDER_REVIEW', adminUser, 'بدء التدقيق الفني');
    assert(step2.success && step2.currentStatus === 'UNDER_REVIEW', 'Valid transition: SUBMITTED ➔ UNDER_REVIEW');

    // ج. انتقال صحيح: UNDER_REVIEW -> APPROVED
    const step3 = await projectsEngineService.transitionStatus(pId, 'APPROVED', adminUser, 'المصادقة والاعتماد النهائي');
    assert(step3.success && step3.currentStatus === 'APPROVED', 'Valid transition: UNDER_REVIEW ➔ APPROVED');

    // د. انتقال صحيح: APPROVED -> IN_PROGRESS
    const step4 = await projectsEngineService.transitionStatus(pId, 'IN_PROGRESS', adminUser, 'بدء التنفيذ الميداني');
    assert(step4.success && step4.currentStatus === 'IN_PROGRESS', 'Valid transition: APPROVED ➔ IN_PROGRESS');

    // هـ. فحص منع الانتقال العشوائي غير القانوني: IN_PROGRESS -> SUBMITTED (يجب أن يفشل)
    let invalidBlocked = false;
    try {
      await projectsEngineService.transitionStatus(pId, 'SUBMITTED', adminUser);
    } catch (e) {
      invalidBlocked = true;
      assert(true, 'Invalid transition correctly blocked by State Machine', e.message);
    }
    if (!invalidBlocked) {
      assert(false, 'Invalid transition was NOT blocked!');
    }
  } catch (err) {
    assert(false, 'Lifecycle state machine failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص إدارة المعالم والمراحل والتقدم الديناميكي (Milestones & Progress)
  // =========================================================================
  console.log('\n🎯 4. فحص إدارة المعالم وحساب الإنجاز الفيزيائي (Milestones & Progress Calculation)...');
  try {
    const pId = createdProject.id;
    const adminUser = { id: 'U-001', role: 'admin' };

    // إضافة معلم 1: أعمال الحفريات والبيس كورس (وزن 40%، منجز 100%)
    const m1 = await projectsEngineService.addMilestone(pId, {
      name: 'أعمال الحفريات وفرش طبقة الأساس (Base Course)',
      weight: 40.0,
      completionPercentage: 100.0,
      plannedDate: '2026-03-01'
    }, adminUser);
    assert(m1 && m1.id, 'Milestone 1 added successfully');

    // إضافة معلم 2: أعمال الخلطة الإسفلتية الساخنة (وزن 60%، منجز 50%)
    const m2 = await projectsEngineService.addMilestone(pId, {
      name: 'توريد وفرد ودحل الخلطة الإسفلتية الساخنة',
      weight: 60.0,
      completionPercentage: 50.0,
      plannedDate: '2026-04-15'
    }, adminUser);
    assert(m2 && m2.id, 'Milestone 2 added successfully');

    // الإنجاز المحسوب: (40 * 100 + 60 * 50) / 100 = (4000 + 3000) / 100 = 70%
    const projAfterMilestones = await projectsEngineService.getProjectById(pId);
    assert(parseFloat(projAfterMilestones.completion_percentage) === 70,
      'Dynamic physical progress calculated accurately from milestones weights', `Expected: 70%, Got: ${projAfterMilestones.completion_percentage}%`);
  } catch (err) {
    assert(false, 'Milestones & progress calculation failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص سجل المخاطر (Project Risk Management)
  // =========================================================================
  console.log('\n⚠️  5. فحص مصفوفة إدارة مخاطر المشروع (Project Risk Register)...');
  try {
    const pId = createdProject.id;
    const risk = await projectsEngineService.addRisk(pId, {
      riskType: 'WEATHER',
      description: 'احتمالية هطول أمطار غزيرة تؤخر أعمال الرصف والتعبيد',
      probability: 'HIGH',
      impact: 'MEDIUM',
      severity: 'HIGH',
      mitigation: 'جدولة أعمال الرصف في الأيام المشمسة وتغطية المواد الأولية'
    });
    assert(risk && risk.id && risk.status === 'OPEN', 'Project risk registered with full impact and mitigation data');
  } catch (err) {
    assert(false, 'Risk management failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص التحليلات المالية والربط عبر الوحدات (Financial Variance & Summary)
  // =========================================================================
  console.log('\n💰 6. فحص التحليلات المالية والانحرافات (Financial Variance & Aggregates)...');
  try {
    const pId = createdProject.id;
    // تحديث التكلفة الفعلية وقيمة العقد
    await projectsEngineService.updateProject(pId, {
      contractedAmount: 115000.00,
      actualCost: 80000.00
    });

    const fullProj = await projectsEngineService.getProjectById(pId);
    const fin = fullProj.financialSummary;
    assert(fin.budgetVariance === 40000, 'Budget Variance calculated accurately (120k - 80k = 40k)', `Got: ${fin.budgetVariance}`);
    assert(fin.contractVariance === 35000, 'Contract Variance calculated accurately (115k - 80k = 35k)', `Got: ${fin.contractVariance}`);
    assert(fin.isUnderBudget === true, 'Project confirmed to be within approved budget cap');
  } catch (err) {
    assert(false, 'Financial variance calculation failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص الاستدعاء عبر منسق المحركات المركزي (Orchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 7. فحص استدعاء PROJECTS_ENGINE عبر EngineOrchestrator...');
  try {
    const pId = createdProject.id;
    const orchProject = await engineOrchestrator.invoke(
      'PROJECTS_ENGINE',
      'getProjectById',
      [pId],
      { user: { id: 'U-001', role: 'admin' }, requiredPermission: 'PROJECTS.VIEW' }
    );
    assert(orchProject && orchProject.id === pId, 'EngineOrchestrator successfully invoked PROJECTS_ENGINE.getProjectById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 8️⃣ فحص حراس الصلاحيات من جانب الخادم (Server-Side Authorization on Projects)
  // =========================================================================
  console.log('\n🔒 8. فحص حراس الصلاحيات والأمان على عمليات المشاريع (Server-Side Authorization)...');
  try {
    const guard = rbacManager.requirePermission('PROJECTS.DELETE');

    // فحص رفض مستخدم بدون صلاحية حذف
    let status403 = null;
    const reqForbidden = {
      user: { id: 'U-009', role: 'inspector', permissions: [] },
      ip: '127.0.0.1',
      originalUrl: `/api/projects/${createdProject.id}`,
      method: 'DELETE'
    };
    const res403 = {
      status: (s) => { status403 = s; return res403; },
      json: () => res403
    };
    await guard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 on project delete');
  } catch (err) {
    assert(false, 'Projects authorization failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك المشاريع الهندسية (PROJECTS_ENGINE / Phase 03):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runProjectsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runProjectsTestSuite;

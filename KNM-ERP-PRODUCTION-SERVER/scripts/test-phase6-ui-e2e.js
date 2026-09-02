/**
 * scripts/test-phase6-ui-e2e.js
 * 🧪 سكريبت الفحص الشامل للواجهة والعمليات المتكاملة End-to-End (Phase 06 E2E Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const engineToUiRegistry = require('../services/engineToUiRegistry');
const projectsEngineService = require('../services/projectsEngineService');
const projectPortfolioEngineService = require('../services/projectPortfolioEngineService');
const projectPrioritizationEngineService = require('../services/projectPrioritizationEngineService');
const projectFinancialProgrammingEngineService = require('../services/projectFinancialProgrammingEngineService');
const projectDependencyEngineService = require('../services/projectDependencyEngineService');
const projectSchedulingEngineService = require('../services/projectSchedulingEngineService');
const tendersEngineService = require('../services/tendersEngineService');
const contractsEngineService = require('../services/contractsEngineService');
const claimsEngineService = require('../services/claimsEngineService');
const roadsEngineService = require('../services/roadsEngineService');
const pavementReturnsEngineService = require('../services/pavementReturnsEngineService');
const assetsEngineService = require('../services/assetsEngineService');
const purchasesEngineService = require('../services/purchasesEngineService');
const inspectionEngineService = require('../services/inspectionEngineService');
const committeesEngineService = require('../services/committeesEngineService');
const archiveEngineService = require('../services/archiveEngineService');
const reportsEngineService = require('../services/reportsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPhase6E2ETestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🌐 بدء الفحص الشامل للواجهة والعمليات المتكاملة End-to-End (Phase 06)');
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

  // =========================================================================
  // 1️⃣ فحص المسار الكامل للمشروع: محفظة -> مشروع -> أولويات -> جدولة (CPM)
  // =========================================================================
  console.log('🏗️ 1. فحص المسار المتكامل لدورة حياة المشروع الهندسي (Portfolio -> Project -> Schedule)...');
  let testProject = null;
  try {
    // أ. إنشاء محفظة استثمارية
    const portfolio = await projectPortfolioEngineService.createPortfolio({
      name: 'محفظة الطرق التنموية 2026 - كفرنجة',
      year: 2026,
      total_budget_cap: 500000.00
    }, adminUser);
    assert(portfolio && portfolio.id, `Portfolio created [${portfolio?.id}]`);

    // ب. إنشاء مشروع هندسي وربطه بالمحفظة
    testProject = await projectsEngineService.createProject({
      name: 'مشروع إعادة تأهيل وتعبيد شارع راجب السياحي',
      portfolio_id: portfolio.id,
      sector: 'طرق وبنية تحتية',
      approved_budget: 120000.00,
      duration_days: 75,
      district: 'راجب'
    }, adminUser);
    assert(testProject && testProject.id, `Project created [${testProject?.id}]`);

    // ج. احتساب أولويات وترجيح المشروع
    const prio = await projectPrioritizationEngineService.calculateProjectPriority(testProject.id, adminUser);
    assert(prio && typeof prio.total_score === 'number', `Priority calculated: Total Score = ${prio?.total_score}`);

    // د. الجدولة الزمنية واحتساب المسار الحرج CPM
    const sched = await projectSchedulingEngineService.calculateNetworkCPM({}, adminUser);
    assert(sched && typeof sched.totalProjects === 'number', `CPM calculated: Total Network Projects = ${sched?.totalProjects}`);
  } catch (err) {
    assert(false, 'Project lifecycle E2E failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص المسار المالي والتعاقدي: عطاء -> عقد -> كفالة -> مطالبة -> صرف
  // =========================================================================
  console.log('\n💰 2. فحص المسار المالي والتعاقدي (Tender -> Contract -> Claim -> Payment)...');
  try {
    // أ. طرح عطاء
    const tender = await tendersEngineService.createTender({
      name: 'عطاء تنفيذ خلطات إسفلتية - راجب',
      estimated_value: 120000.00,
      projectId: testProject.id
    }, adminUser);
    assert(tender && tender.id, `Tender created [${tender?.id}]`);

    // ب. توثيق العقد والكفالة
    const contract = await contractsEngineService.createContract({
      title: 'عقد تنفيذ خلطات إسفلتية - راجب',
      tender_id: tender.id,
      contractor_name: 'شركة صقور الشمال للتعهدات',
      total_value: 115000.00,
      guarantee_value: 11500.00,
      bank_name: 'البنك الإسلامي الأردني'
    }, adminUser);
    assert(contract && contract.id, `Contract created [${contract?.id}] with Bank Guarantee`);

    // ج. تسجيل ومصادقة مطالبة مالية
    const claim = await claimsEngineService.createClaim({
      tenderId: tender.id,
      contractor: 'شركة صقور الشمال للتعهدات',
      amount: 40000.00,
      retentionPercentage: 10.0
    }, adminUser);
    assert(claim && parseFloat(claim.netPayable) === 36000, `Claim created: Net = 36,000 JD (10% retention withheld)`);

    const auditClaim = await claimsEngineService.auditClaim(claim.id, {
      newStatus: 'معتمدة ومصروفة',
      approvedAmount: 40000.00
    }, adminUser);
    assert(auditClaim && auditClaim.status === 'معتمدة ومصروفة', 'Claim audited & approved for payment');
  } catch (err) {
    assert(false, 'Financial & Contract E2E failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص مسار الطرق والأصول وعوائد التعبيد: طريق -> PCI -> عوائد -> أصل
  // =========================================================================
  console.log('\n🛣️ 3. فحص مسار شبكة الطرق وعوائد التعبيد والأصول (Road -> PCI -> Returns -> Asset)...');
  try {
    // أ. طريق وتقييم PCI
    const road = await roadsEngineService.createRoad({
      name: 'شارع راجب الدائري',
      category: 'تجميعي',
      length_km: 2.2,
      pci_score: 80
    }, adminUser);
    assert(road && road.id, `Road created [${road?.id}]`);

    // ب. قيد عوائد تعبيد وتحصيل
    const pav = await pavementReturnsEngineService.createPavingReturn({
      tender_id: 'T-2026-065',
      owner_name: 'علي حسن الفريحات',
      piece_number: '88',
      basin_number: '2 - راجب',
      frontage_length: 30.0,
      paving_width: 3.0,
      price_per_sqm: 4.5
    }, adminUser);
    assert(pav && parseFloat(pav.required_amount) === 405.00, `Paving return calculated: 405.00 JD`);

    const paid = await pavementReturnsEngineService.recordPayment(pav.id, {
      amountPaid: 405.00,
      receiptNumber: 'REC-2026-PAV-8812'
    }, adminUser);
    assert(paid && paid.payment_status === 'PAID', 'Paving return fully collected & receipt generated');

    // ج. توثيق أصل بلدي إنشائي
    const asset = await assetsEngineService.createAsset({
      name: 'جدار استنادي خرساني لحماية مجرى سيل راجب',
      asset_type: 'جدار استنادي',
      district: 'راجب',
      initial_cost: 28000.00
    }, adminUser);
    assert(asset && asset.id, `Structural asset created [${asset?.id}]`);
  } catch (err) {
    assert(false, 'Roads & Assets E2E failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص التفتيش واللجان والأرشفة والتقارير: تفتيش -> محضر -> وثيقة -> تقرير
  // =========================================================================
  console.log('\n🔍 4. فحص التفتيش الميداني واللجان والأرشفة والطباعة (Inspection -> Committee -> Archive -> Report)...');
  try {
    const insp = await inspectionEngineService.recordInspection({
      roadId: 'RD-001',
      siteLocation: 'شارع راجب',
      condition: 'PASSED',
      notes: 'الأعمال مطابقة للمواصفات'
    }, engineerUser);
    assert(insp && insp.id, 'Inspection recorded');

    const comm = await committeesEngineService.createReport({
      committeeType: 'لجنة استلام أولي',
      title: 'محضر استلام أولي لأعمال راجب',
      decision: 'APPROVED'
    }, adminUser);
    assert(comm && comm.id, 'Committee report approved');

    const doc = await archiveEngineService.indexDocument({
      title: 'مخطط نهائي as-built لشارع راجب',
      fileName: 'rajeb_asbuilt.pdf',
      entityType: 'PROJECT',
      entityId: testProject.id
    }, engineerUser);
    assert(doc && doc.id, 'Document archived & linked to project');

    const header = reportsEngineService.generateOfficialHeader('تقرير الإنجاز النهائي للمشروع');
    assert(header && header.municipality === 'بلدية كفرنجة الجديدة', 'Official municipal print header rendered');
  } catch (err) {
    assert(false, 'Inspection & Reports E2E failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص توثيق سجل التدقيق الكامل لجميع العمليات (Full Audit Trail Verification)
  // =========================================================================
  console.log('\n📜 5. التحقق من توثيق سجل التدقيق والرقابة (Audit Trail Integrity)...');
  try {
    let count = 0;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery('SELECT COUNT(*) as count FROM activity_log');
      count = parseInt(logs[0]?.count || 0, 10);
    } else {
      count = (memDb.activity_log || []).length;
    }
    assert(count > 0, `Audit log contains ${count} immutable operational records`);
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الشامل للعمليات المتكاملة (Phase 06 E2E):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase6E2ETestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase6E2ETestSuite;

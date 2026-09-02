/**
 * scripts/test-final-enterprise-engines-closure.js
 * 🏆 سكريبت الفحص الختامي الشامل لجميع المحركات المؤسسية الـ 28 (Final Enterprise Engines Closure Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const inspectionEngineService = require('../services/inspectionEngineService');
const committeesEngineService = require('../services/committeesEngineService');
const archiveEngineService = require('../services/archiveEngineService');
const reportsEngineService = require('../services/reportsEngineService');
const g2gGatewayEngineService = require('../services/g2gGatewayEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runFinalEnterpriseClosureTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏆 بدء الفحص النهائي الشامل لإغلاق جميع المحركات المؤسسية الـ 28 بالكامل');
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
  // 1️⃣ فحص تسجيل وصحة جميع المحركات الـ 28 في سجل المحركات
  // =========================================================================
  console.log('📋 1. التحقق من اكتمال تسجيل وصحة جميع المحركات الـ 28 المؤسسية...');
  try {
    const allEngines = engineRegistry.list();
    assert(allEngines.length >= 28, `All ${allEngines.length} Enterprise Engines are registered`);

    let healthyCount = 0;
    for (const e of allEngines) {
      const h = await engineRegistry.checkEngineHealth(e.engineId);
      if (h.healthy) healthyCount++;
    }
    assert(healthyCount === allEngines.length, `All ${allEngines.length} engines returned HEALTHY status`);
  } catch (err) {
    assert(false, 'Engine registry health check failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص محرك التفتيش الميداني (Inspection Engine)
  // =========================================================================
  console.log('\n🔍 2. فحص محرك التفتيش الميداني وضبط الجودة (INSPECTION_ENGINE)...');
  try {
    const insp = await inspectionEngineService.recordInspection({
      siteLocation: 'شارع وادي راجب السياحي',
      condition: 'PASSED',
      notes: 'تم فحص سمك طبقة الأسفلت ونسبة الدمك وكانت مطابقة للمواصفات'
    }, engineerUser);

    assert(insp && insp.id, `Inspection record created with ID [${insp?.id}]`);
    const health = await inspectionEngineService.healthCheck();
    assert(health.healthy === true, 'INSPECTION_ENGINE is HEALTHY');
  } catch (err) {
    assert(false, 'Inspection engine failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص محرك اللجان الفنية ولجان الاستلام (Committees Engine)
  // =========================================================================
  console.log('\n🏛️ 3. فحص محرك اللجان الفنية ولجان الاستلام (COMMITTEES_ENGINE)...');
  try {
    const comm = await committeesEngineService.createReport({
      committeeType: 'لجنة استلام أولي',
      title: 'محضر الاستلام الأولي لعطاء خلطات إسفلتية ساخنة - كفرنجة',
      tenderId: 'T-2026-065',
      decision: 'APPROVED',
      recommendations: 'التوصية بالإفراج عن نصف كفالة حسن التنفيذ والاحتفاظ بنصفها ككفالة صيانة'
    }, adminUser);

    assert(comm && comm.id, `Committee report created with ID [${comm?.id}]`);
    const health = await committeesEngineService.healthCheck();
    assert(health.healthy === true, 'COMMITTEES_ENGINE is HEALTHY');
  } catch (err) {
    assert(false, 'Committees engine failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص محرك الأرشفة الرقمية والوثائق (Archive & Document Engine)
  // =========================================================================
  console.log('\n📁 4. فحص محرك الأرشفة الرقمية وتخزين المستندات (ARCHIVE_DOCUMENT_ENGINE)...');
  try {
    const doc = await archiveEngineService.indexDocument({
      title: 'مخططات الإسقاط المساحي والمسار الهندسي - طريق كفرنجة العامرية',
      fileName: 'kafranjah_survey_2026.dwg',
      entityType: 'PROJECT',
      entityId: 'PRJ-2026-001'
    }, engineerUser);

    assert(doc && doc.id, `Document indexed with ID [${doc?.id}]`);
    const health = await archiveEngineService.healthCheck();
    assert(health.healthy === true, 'ARCHIVE_DOCUMENT_ENGINE is HEALTHY');
  } catch (err) {
    assert(false, 'Archive engine failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص محرك التقارير ونماذج الطباعة (Print Reports Engine)
  // =========================================================================
  console.log('\n🖨️ 5. فحص محرك التقارير ونماذج الطباعة الرسمية (PRINT_REPORT_ENGINE)...');
  try {
    const header = reportsEngineService.generateOfficialHeader('تقرير الإنجاز الدوري للمشاريع الهندسية');
    assert(header.municipality === 'بلدية كفرنجة الجديدة', 'Official header contains municipality name');
    assert(header.watermarkText.includes('كفرنجة'), 'Watermark rendered correctly');
  } catch (err) {
    assert(false, 'Reports engine failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص محرك بوابة الربط الحكومي (G2G Gateway Engine)
  // =========================================================================
  console.log('\n🌐 6. فحص محرك بوابة الربط الحكومي والتكامل الوزاري (G2G_GATEWAY_ENGINE)...');
  try {
    const g2gTx = await g2gGatewayEngineService.dispatchPayload(
      'وزارة الإدارة المحلية - مديرية المشاريع',
      'ANNUAL_PROJECTS_PLAN_SYNC',
      { portfolioId: 'PORT-2026-INVEST', totalBudget: 500000 },
      adminUser
    );

    assert(g2gTx && g2gTx.transactionId, `G2G transaction dispatched with ID [${g2gTx?.transactionId}]`);
    assert(g2gTx.status === 'TRANSMITTED_SUCCESSFULLY', 'G2G transmission confirmed');
  } catch (err) {
    assert(false, 'G2G gateway engine failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص الاستدعاء الموحد لجميع المحركات عبر EngineOrchestrator
  // =========================================================================
  console.log('\n🎼 7. فحص الاستدعاء الموحد عبر منسق المحركات المركزي (EngineOrchestrator)...');
  try {
    const res1 = await engineOrchestrator.invoke('PROJECTS_ENGINE', 'getProjects', [{}], { user: adminUser });
    assert(Array.isArray(res1), 'Orchestrator invoked PROJECTS_ENGINE');

    const res2 = await engineOrchestrator.invoke('TENDERS_ENGINE', 'getTenders', [{}], { user: adminUser });
    assert(Array.isArray(res2), 'Orchestrator invoked TENDERS_ENGINE');

    const res3 = await engineOrchestrator.invoke('CONTRACTS_ENGINE', 'getContracts', [{}], { user: adminUser });
    assert(Array.isArray(res3), 'Orchestrator invoked CONTRACTS_ENGINE');

    const res4 = await engineOrchestrator.invoke('ROADS_ENGINE', 'getNetworkStats', [], { user: adminUser });
    assert(res4 && typeof res4.totalRoadsCount === 'number', 'Orchestrator invoked ROADS_ENGINE');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية للفحص الختامي لجميع المحركات المؤسسية:`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي والإغلاق الكامل: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runFinalEnterpriseClosureTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runFinalEnterpriseClosureTestSuite;

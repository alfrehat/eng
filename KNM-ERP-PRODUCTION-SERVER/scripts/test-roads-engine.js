/**
 * scripts/test-roads-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك شبكة الطرق وتقييم الرصفات PCI (Phase 06 Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const roadsEngineService = require('../services/roadsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runRoadsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛣️ بدء الفحص الشامل لمحرك شبكة الطرق وتقييم الرصفات PCI (Phase 06)');
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
  const unauthorizedUser = { id: 'U-009', username: 'auditor', fullName: 'مدقق حسابات', role: 'accountant', permissions: [] };

  // =========================================================================
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل ROADS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('ROADS_ENGINE');
    assert(engineEntry !== undefined, 'ROADS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'ROADS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('roads_crud'), 'Declared capability: roads_crud');
    assert(engineEntry && engineEntry.capabilities.includes('pci_assessment'), 'Declared capability: pci_assessment');
    assert(engineEntry && engineEntry.capabilities.includes('network_statistics'), 'Declared capability: network_statistics');

    const health = await engineRegistry.checkEngineHealth('ROADS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'ROADS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص خوارزمية احتساب مؤشر الرصفة (PCI Algorithm Validation)
  // =========================================================================
  console.log('\n🧮 2. فحص خوارزمية احتساب مؤشر حالة الرصفات PCI (ASTM D6433)...');
  try {
    // حالة 1: طريق ممتاز (بدون عيوب)
    const pci1 = roadsEngineService.calculatePCI([]);
    assert(pci1.pciScore === 100 && pci1.conditionRating === 'EXCELLENT', 'Zero distresses gives PCI = 100 (EXCELLENT)');

    // حالة 2: طريق متوسط العيوب (شقوق تمساحية وشقوق طولية)
    const pci2 = roadsEngineService.calculatePCI([
      { type: 'ALLIGATOR_CRACKING', severity: 'MEDIUM', density: 15 },
      { type: 'LONGITUDINAL_CRACKING', severity: 'LOW', density: 10 }
    ]);
    assert(pci2.pciScore < 100 && pci2.pciScore >= 55 && (pci2.conditionRating === 'GOOD' || pci2.conditionRating === 'FAIR'),
      `Moderate distresses gives PCI = ${pci2.pciScore} (${pci2.conditionRating})`);

    // حالة 3: طريق متدهور بحفر شديدة وهبوطات
    const pci3 = roadsEngineService.calculatePCI([
      { type: 'POTHOLES', severity: 'HIGH', density: 25 },
      { type: 'RUTTING', severity: 'HIGH', density: 25 }
    ]);
    assert(pci3.pciScore < 40 && (pci3.conditionRating === 'POOR' || pci3.conditionRating === 'FAILED'),
      `Severe distresses gives Critical PCI = ${pci3.pciScore} (${pci3.conditionRating})`);
  } catch (err) {
    assert(false, 'PCI calculation algorithm failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إنشاء طريق جديد وإجراء تقييم مسح ميداني (Road Creation & PCI Survey)
  // =========================================================================
  console.log('\n🏗️ 3. فحص إنشاء طريق جديد وتوثيق مسح ميداني للرصفة...');
  let createdRoad = null;
  try {
    createdRoad = await roadsEngineService.createRoad({
      name: 'شارع الملك طلال الرئيسي - كفرنجة',
      category: 'شرياني',
      length_km: 3.5,
      width_m: 12.0,
      lanes_count: 4,
      pci_score: 85,
      surface_condition: 'خلطة إسفلتية ساخنة',
      district: 'كفرنجة المركز'
    }, adminUser);

    assert(createdRoad && createdRoad.id, `Road created successfully with ID [${createdRoad?.id}]`);
    assert(createdRoad.category === 'شرياني', 'Road category is [شرياني]');

    // توثيق مسح ميداني جديد للطريق
    const surveyRes = await roadsEngineService.addPciSurvey(createdRoad.id, {
      distresses: [
        { type: 'BLOCK_CRACKING', severity: 'MEDIUM', density: 12 }
      ],
      surveyorName: 'م. أحمد الفريحات'
    }, adminUser);

    assert(surveyRes && surveyRes.success === true, 'PCI field survey recorded and updated road score');
    assert(surveyRes.pciEvaluation.pciScore > 0, `Updated road PCI is ${surveyRes.pciEvaluation.pciScore}`);
  } catch (err) {
    assert(false, 'Road creation & survey failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص إحصائيات شبكة الطرق للمديرية (Network Statistics)
  // =========================================================================
  console.log('\n📊 4. فحص استخراج إحصائيات شبكة الطرق الكلية...');
  try {
    const stats = await roadsEngineService.getNetworkStats();
    assert(stats && typeof stats.totalRoadsCount === 'number' && stats.totalRoadsCount > 0,
      'getNetworkStats returned valid network totals');
    assert(typeof stats.totalLengthKm === 'number' && stats.totalLengthKm > 0,
      `Total network length: ${stats.totalLengthKm} km`);
    assert(typeof stats.averageNetworkPCI === 'number',
      `Average network PCI: ${stats.averageNetworkPCI}`);
  } catch (err) {
    assert(false, 'Network stats failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء ROADS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'ROADS_ENGINE',
      'getRoadById',
      [createdRoad.id],
      { user: engineerUser, requiredPermission: 'ROADS.VIEW' }
    );
    assert(orchResult && orchResult.id === createdRoad.id,
      'EngineOrchestrator successfully invoked ROADS_ENGINE.getRoadById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('ROADS.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/roads', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/roads', method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await createGuard(reqForbidden, res403, () => {});
    assert(status403 === 403, 'Unauthorized user strictly BLOCKED with 403 FORBIDDEN');
  } catch (err) {
    assert(false, 'Authorization guards failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)
  // =========================================================================
  console.log('\n📜 7. فحص توثيق سجل التدقيق والرقابة المؤسسية (Audit Trail)...');
  try {
    let auditFound = false;
    if (isPostgresActive()) {
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'شبكة الطرق والرصفات' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'شبكة الطرق والرصفات');
    }
    assert(auditFound === true, 'Audit log records successfully created for road operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك شبكة الطرق وتقييم الرصفات (Phase 06):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runRoadsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runRoadsTestSuite;

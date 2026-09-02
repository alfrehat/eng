/**
 * scripts/test-contracts-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك العقود والكفالات والأوامر التغييرية (Phase 05-B Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const contractsEngineService = require('../services/contractsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runContractsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📜 بدء الفحص الشامل لمحرك العقود والكفالات والأوامر التغييرية (Phase 05-B)');
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
  console.log('📋 1. فحص تسجيل CONTRACTS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('CONTRACTS_ENGINE');
    assert(engineEntry !== undefined, 'CONTRACTS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'CONTRACTS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('contracts_crud'), 'Declared capability: contracts_crud');
    assert(engineEntry && engineEntry.capabilities.includes('variation_orders'), 'Declared capability: variation_orders');
    assert(engineEntry && engineEntry.capabilities.includes('bank_guarantees'), 'Declared capability: bank_guarantees');

    const health = await engineRegistry.checkEngineHealth('CONTRACTS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'CONTRACTS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص إنشاء وتوثيق عقد إنشائي جديد وكفالته (Contract Creation & Guarantee)
  // =========================================================================
  console.log('\n🏗️ 2. فحص إنشاء وتوثيق عقد إنشائي جديد مع كفالة حسن التنفيذ...');
  let testContract = null;
  try {
    testContract = await contractsEngineService.createContract({
      title: 'عقد تنفيذ أعمال الخلطات الإسفلتية الساخنة - كفرنجة',
      tender_id: 'T-2026-065',
      contractor_name: 'شركة صقور الشمال للتعهدات الإنشائية',
      total_value: 100000.00,
      execution_period_days: 90,
      guarantee_value: 10000.00,
      bank_name: 'البنك الإسلامي الأردني',
      guarantee_number: 'BG-2026-ISL-8821',
      guarantee_expiry_date: '2026-12-31'
    }, adminUser);

    assert(testContract && testContract.id, `Contract created successfully with ID [${testContract?.id}]`);
    assert(parseFloat(testContract.total_value) === 100000, 'Contract total value accurately recorded as 100,000 JD');
    assert(Array.isArray(testContract.guarantees_list) && testContract.guarantees_list.length > 0,
      'Performance bank guarantee automatically attached to contract');
  } catch (err) {
    assert(false, 'Contract creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص الأوامر التغييرية والحد القانوني 25% (Variation Orders)
  // =========================================================================
  console.log('\n⚖️ 3. فحص الأوامر التغييرية والتحقق من السقف القانوني (25%)...');
  try {
    // أمر تغييري رقم 1: بقيمة 15,000 د.أ (15% من العقد) -> مسموح ومقبول
    const vo1 = await contractsEngineService.addVariationOrder(testContract.id, {
      amount: 15000.00,
      extension_days: 15,
      description: 'إضافة وصلات طرق فرعية حيوية بالحي الشرقي',
      justification: 'مطالب أهالي وتقرير لجنة السلامة المرورية'
    }, adminUser);

    assert(vo1 && vo1.is_exceeding_limit === false && vo1.status === 'APPROVED',
      'VO #1 (15%) is within legal limits and marked APPROVED');

    // أمر تغييري رقم 2: بقيمة 15,000 د.أ إضافية (المجموع التراكمي 30,000 د.أ = 30% > 25%) -> يتطلب موافقة الوزارة
    const vo2 = await contractsEngineService.addVariationOrder(testContract.id, {
      amount: 15000.00,
      extension_days: 20,
      description: 'أعمال جدران استنادية إضافية غير مدرجة',
      justification: 'معالجة انهيارات تربة طارئة'
    }, adminUser);

    assert(vo2 && vo2.is_exceeding_limit === true && vo2.status === 'REQUIRES_MINISTRY_APPROVAL',
      'Cumulative VO #2 (30%) strictly flagged as EXCEEDING_LEGAL_LIMIT requiring ministry approval');
  } catch (err) {
    assert(false, 'Variation orders verification failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص دورة حياة الكفالات البنكية وتنبيهات الاستحقاق (Guarantees & Alerts)
  // =========================================================================
  console.log('\n🛡️ 4. فحص دورة حياة الكفالة البنكية (تمديد، إفراج، وتنبيهات استحقاق)...');
  try {
    const bgs = await contractsEngineService.getBankGuarantees(testContract.id);
    assert(bgs.length > 0, 'Contract has active bank guarantees');

    const firstBg = bgs[0];
    const extRes = await contractsEngineService.extendBankGuarantee(firstBg.id, {
      new_expiry_date: '2027-03-31',
      notes: 'تمديد الكفالة لتغطية فترة الصيانة التعاقدية'
    }, adminUser);
    assert(extRes.success === true, 'Bank guarantee successfully extended to 2027-03-31');

    const alerts = await contractsEngineService.getGuaranteesAlerts();
    assert(alerts !== undefined && Array.isArray(alerts.within_30_days),
      'Bank guarantees smart alerts engine generated expiration tiers');
  } catch (err) {
    assert(false, 'Bank guarantees lifecycle failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء CONTRACTS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'CONTRACTS_ENGINE',
      'getContractById',
      [testContract.id],
      { user: engineerUser, requiredPermission: 'CONTRACTS.VIEW' }
    );
    assert(orchResult && orchResult.id === testContract.id,
      'EngineOrchestrator successfully invoked CONTRACTS_ENGINE.getContractById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('CONTRACTS.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/contracts', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/contracts', method: 'POST' };
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'العقود والضمانات البنكية' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'العقود والضمانات البنكية');
    }
    assert(auditFound === true, 'Audit log records successfully created for contract operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك العقود والكفالات (Phase 05-B):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runContractsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runContractsTestSuite;

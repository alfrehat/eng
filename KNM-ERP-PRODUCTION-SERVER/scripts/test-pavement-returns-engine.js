/**
 * scripts/test-pavement-returns-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك عوائد التعبيد والتحققات البلدية (Phase 07 Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const pavementReturnsEngineService = require('../services/pavementReturnsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPavementReturnsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏗️ بدء الفحص الشامل لمحرك عوائد التعبيد والتحققات البلدية (Phase 07)');
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
  const accountantUser = { id: 'U-003', username: 'acc_omar', fullName: 'عمر المالي', role: 'accountant' };
  const unauthorizedUser = { id: 'U-009', username: 'guest', fullName: 'زائر', role: 'guest', permissions: [] };

  // =========================================================================
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل PAVEMENT_RETURNS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('PAVEMENT_RETURNS_ENGINE');
    assert(engineEntry !== undefined, 'PAVEMENT_RETURNS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PAVEMENT_RETURNS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('paving_returns_calculation'), 'Declared capability: paving_returns_calculation');
    assert(engineEntry && engineEntry.capabilities.includes('revenue_collection'), 'Declared capability: revenue_collection');

    const health = await engineRegistry.checkEngineHealth('PAVEMENT_RETURNS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PAVEMENT_RETURNS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص خوارزمية احتساب عوائد التعبيد القانونية (Paving Returns Calculation)
  // =========================================================================
  console.log('\n🧮 2. فحص خوارزمية احتساب عوائد التعبيد (طول × عرض × سعر × نسبة)...');
  try {
    // واجهة 20 متر × عرض 4 متر = 80 م2 × 4.5 د.أ = 360 د.أ
    const calc = pavementReturnsEngineService.calculatePavingReturn(20.0, 4.0, 4.5, 1.0);
    assert(calc.areaSquareMeters === 80, 'Paving area accurately calculated as 80 m2');
    assert(calc.requiredAmount === 360, 'Required amount accurately calculated as 360.00 JD');
  } catch (err) {
    assert(false, 'Calculation algorithm failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إنشاء وتوثيق قيد عوائد تعبيد لقطعة أرض (Creation & Parcel Tracking)
  // =========================================================================
  console.log('\n🏗️ 3. فحص إنشاء وتوثيق قيد عوائد تعبيد جديد...');
  let createdReturn = null;
  try {
    createdReturn = await pavementReturnsEngineService.createPavingReturn({
      tender_id: 'T-2026-065',
      owner_name: 'محمد عبدالله الفريحات',
      national_id: '9801023456',
      piece_number: '152',
      basin_number: '4 - البلد',
      district: 'كفرنجة',
      street_name: 'شارع المستشفى العسكري',
      frontage_length: 25.0,
      paving_width: 3.5,
      price_per_sqm: 4.5,
      imposition_rate: 1.0
    }, adminUser);

    assert(createdReturn && createdReturn.id, `Paving return created with ID [${createdReturn?.id}]`);
    assert(createdReturn.payment_status === 'UNPAID', 'Initial payment status is UNPAID');
    assert(parseFloat(createdReturn.required_amount) === 393.75, 'Required amount saved as 393.75 JD');
  } catch (err) {
    assert(false, 'Paving return creation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص تحصيل الدفعة وسند القبض (Payment Recording & Receipt)
  // =========================================================================
  console.log('\n💵 4. فحص تحصيل الدفعة وتوليد سند القبض المالي...');
  try {
    // تسديد كامل المبلغ 393.75 د.أ
    const paidResult = await pavementReturnsEngineService.recordPayment(createdReturn.id, {
      amountPaid: 393.75,
      receiptNumber: 'REC-2026-PAV-0912',
      paymentDate: '2026-08-29',
      notes: 'سداد عوائد التعبيد نقداً لدى محاسب البلدية'
    }, accountantUser);

    assert(paidResult && paidResult.payment_status === 'PAID', 'Payment status updated to PAID');
    assert(parseFloat(paidResult.paid_amount) === 393.75, 'Paid amount accurately recorded as 393.75 JD');
    assert(paidResult.receipt_number === 'REC-2026-PAV-0912', 'Receipt number recorded');
  } catch (err) {
    assert(false, 'Payment recording failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الإحصائيات التجميعية والتحصيلات (Revenue Analytics)
  // =========================================================================
  console.log('\n📊 5. فحص تقرير التحصيلات وعوائد التعبيد الإجمالية...');
  try {
    const stats = await pavementReturnsEngineService.getReturnsStats();
    assert(stats && typeof stats.totalRecords === 'number' && stats.totalRecords > 0,
      'getReturnsStats returned valid summary');
    assert(typeof stats.totalCollectedAmount === 'number' && stats.totalCollectedAmount > 0,
      `Total collected revenue: ${stats.totalCollectedAmount} JD`);
  } catch (err) {
    assert(false, 'Returns stats failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 6. فحص استدعاء PAVEMENT_RETURNS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'PAVEMENT_RETURNS_ENGINE',
      'getPavingReturnById',
      [createdReturn.id],
      { user: accountantUser, requiredPermission: 'PAVING.VIEW' }
    );
    assert(orchResult && orchResult.id === createdReturn.id,
      'EngineOrchestrator successfully invoked PAVEMENT_RETURNS_ENGINE.getPavingReturnById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 7. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('PAVING.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/paving-returns', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/paving-returns', method: 'POST' };
    const res403 = { status: (s) => { status403 = s; return res403; }, json: () => res403 };
    await createGuard(reqForbidden, res403, () => {});
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'عوائد التعبيد والتحققات البلدية' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'عوائد التعبيد والتحققات البلدية');
    }
    assert(auditFound === true, 'Audit log records successfully created for paving returns operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك عوائد التعبيد (Phase 07):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPavementReturnsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPavementReturnsTestSuite;

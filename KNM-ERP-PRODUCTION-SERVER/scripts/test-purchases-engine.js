/**
 * scripts/test-purchases-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك المشتريات والتوريدات الهندسية (Phase 09 Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const purchasesEngineService = require('../services/purchasesEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runPurchasesTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛒 بدء الفحص الشامل لمحرك المشتريات والتوريدات ولجان الاستلام (Phase 09)');
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
  console.log('📋 1. فحص تسجيل PURCHASES_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('PURCHASES_ENGINE');
    assert(engineEntry !== undefined, 'PURCHASES_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'PURCHASES_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('purchases_crud'), 'Declared capability: purchases_crud');
    assert(engineEntry && engineEntry.capabilities.includes('receiving_committee'), 'Declared capability: receiving_committee');

    const health = await engineRegistry.checkEngineHealth('PURCHASES_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'PURCHASES_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص إنشاء أمر شراء وتوريد مواد هندسية (Purchase Order Creation)
  // =========================================================================
  console.log('\n🏗️ 2. فحص إنشاء وتوثيق أمر شراء مباشر لمواد هندسية...');
  let createdPurchase = null;
  try {
    createdPurchase = await purchasesEngineService.createPurchase({
      item: 'دهان حراري عاكس لتخطيط الشوارع الرئيسية وممرات المشاة',
      quantity: 50,
      unit: 'برميل',
      price: 90.00,
      value: 4500.00,
      supplier: 'شركة الدهانات الحديثة للصناعة والتجارة',
      purchaseType: 'شراء مباشر بموجب استدراج عروض',
      department: 'مديرية الأشغال والخدمات الهندسية'
    }, adminUser);

    assert(createdPurchase && createdPurchase.id, `Purchase order created with ID [${createdPurchase?.id}]`);
    assert(parseFloat(createdPurchase.value) === 4500, 'Total purchase value recorded as 4,500 JD');
    assert(createdPurchase.status === 'بانتظار موافقة مدير الأشغال', 'Initial status is pending approval');
  } catch (err) {
    assert(false, 'Purchase order creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إجراءات لجنة الاستلام الفني (Receiving Committee Inspection)
  // =========================================================================
  console.log('\n📦 3. فحص توثيق استلام المواد عبر لجنة الاستلام الفني...');
  try {
    const receiveRes = await purchasesEngineService.receivePurchaseItems(createdPurchase.id, {
      inspectionNotes: 'تم فحص عينات الدهان الحراري ومطابقتها للمواصفات الفنية المعتمدة لدى وزارة الأشغال',
      committeeMembers: 'م. أحمد الفريحات، م. رائد الصمادي، أمين المستودع'
    }, adminUser);

    assert(receiveRes && receiveRes.status === 'تم الاستلام والمطابقة الفنية', 'Status transitioned to received & verified');
  } catch (err) {
    assert(false, 'Receiving committee failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص الإحصائيات التجميعية للمشتريات (Purchases Analytics)
  // =========================================================================
  console.log('\n📊 4. فحص الإحصائيات التجميعية للمشتريات والتوريدات...');
  try {
    const stats = await purchasesEngineService.getPurchasesStats();
    assert(stats && typeof stats.totalPurchasesCount === 'number' && stats.totalPurchasesCount > 0,
      'getPurchasesStats returned valid totals');
    assert(typeof stats.totalSpendValue === 'number' && stats.totalSpendValue > 0,
      `Total procurement spend: ${stats.totalSpendValue} JD`);
  } catch (err) {
    assert(false, 'Purchases stats failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء PURCHASES_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'PURCHASES_ENGINE',
      'getPurchaseById',
      [createdPurchase.id],
      { user: accountantUser, requiredPermission: 'PURCHASES.VIEW' }
    );
    assert(orchResult && orchResult.id === createdPurchase.id,
      'EngineOrchestrator successfully invoked PURCHASES_ENGINE.getPurchaseById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('PURCHASES.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/purchases', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/purchases', method: 'POST' };
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'المشتريات والتوريدات الهندسية' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'المشتريات والتوريدات الهندسية');
    }
    assert(auditFound === true, 'Audit log records successfully created for purchases operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك المشتريات والتوريدات (Phase 09):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPurchasesTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPurchasesTestSuite;

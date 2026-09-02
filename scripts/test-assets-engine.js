/**
 * scripts/test-assets-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك الأصول البلدية والمرافق والآليات (Phase 08 Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const assetsEngineService = require('../services/assetsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runAssetsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ بدء الفحص الشامل لمحرك الأصول البلدية والمرافق والآليات الهندسية (Phase 08)');
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
  const unauthorizedUser = { id: 'U-009', username: 'guest', fullName: 'زائر', role: 'guest', permissions: [] };

  // =========================================================================
  // 1️⃣ فحص تسجيل المحرك وفحص الصحة (Engine Registry & Health Check)
  // =========================================================================
  console.log('📋 1. فحص تسجيل ASSETS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('ASSETS_ENGINE');
    assert(engineEntry !== undefined, 'ASSETS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'ASSETS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('assets_crud'), 'Declared capability: assets_crud');
    assert(engineEntry && engineEntry.capabilities.includes('structural_assets'), 'Declared capability: structural_assets');
    assert(engineEntry && engineEntry.capabilities.includes('condition_depreciation_calculation'), 'Declared capability: condition_depreciation_calculation');

    const health = await engineRegistry.checkEngineHealth('ASSETS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'ASSETS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص خوارزمية احتساب الاستهلاك والقيمة الدفترية (Depreciation Calculation)
  // =========================================================================
  console.log('\n🧮 2. فحص خوارزمية احتساب الاستهلاك الخطي والقيمة الدفترية للأصل...');
  try {
    // أصل بقيمة 50,000 د.أ تم اقتناؤه عام 2021 (منذ 5 سنوات)، العمر التشغيلي 20 سنة
    const currentYear = new Date().getFullYear();
    const acqYear = currentYear - 5;
    const dep = assetsEngineService.calculateAssetDepreciation(50000.00, acqYear, 20, 0);

    assert(dep.initialCost === 50000, 'Initial cost is 50,000 JD');
    assert(dep.annualDepreciation === 2500, 'Annual depreciation accurately calculated as 2,500 JD');
    assert(dep.accumulatedDepreciation === 12500, 'Accumulated 5-year depreciation accurately calculated as 12,500 JD');
    assert(dep.currentBookValue === 37500, 'Current book value accurately calculated as 37,500 JD');
  } catch (err) {
    assert(false, 'Depreciation calculation algorithm failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إنشاء وتوثيق أصل بلدي إنشائي (Asset Creation)
  // =========================================================================
  console.log('\n🏗️ 3. فحص إنشاء وتوثيق أصل بلدي إنشائي جديد...');
  let createdAsset = null;
  try {
    createdAsset = await assetsEngineService.createAsset({
      name: 'جدار استنادي خرساني مسلح - طريق وادي راجب',
      asset_type: 'جدار استنادي',
      district: 'راجب',
      condition_index: 90,
      height_meters: 6.5,
      initial_cost: 35000.00,
      acquisition_year: 2025,
      notes: 'حماية المنحدر الجبلي من الانجرافات الشتوية'
    }, adminUser);

    assert(createdAsset && createdAsset.id, `Asset created with ID [${createdAsset?.id}]`);
    assert(createdAsset.asset_type === 'جدار استنادي', 'Asset type is [جدار استنادي]');
    assert(createdAsset.condition_index === 90, 'Condition index recorded as 90 (EXCELLENT)');
  } catch (err) {
    assert(false, 'Asset creation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص الإحصائيات التجميعية للأصول البلدية (Assets Analytics)
  // =========================================================================
  console.log('\n📊 4. فحص الإحصائيات التجميعية لأصول ومرافق البلدية...');
  try {
    const stats = await assetsEngineService.getAssetsStats();
    assert(stats && typeof stats.totalAssetsCount === 'number' && stats.totalAssetsCount > 0,
      'getAssetsStats returned valid summary totals');
    assert(typeof stats.totalEstimatedValue === 'number' && stats.totalEstimatedValue > 0,
      `Total estimated assets value: ${stats.totalEstimatedValue} JD`);
  } catch (err) {
    assert(false, 'Assets stats failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء ASSETS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'ASSETS_ENGINE',
      'getAssetById',
      [createdAsset.id],
      { user: engineerUser, requiredPermission: 'ASSETS.VIEW' }
    );
    assert(orchResult && orchResult.id === createdAsset.id,
      'EngineOrchestrator successfully invoked ASSETS_ENGINE.getAssetById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('ASSETS.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/assets/structural', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/assets/structural', method: 'POST' };
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'الأصول البلدية والمرافق والآليات' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'الأصول البلدية والمرافق والآليات');
    }
    assert(auditFound === true, 'Audit log records successfully created for municipal assets operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك الأصول والمرافق البلدية (Phase 08):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runAssetsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runAssetsTestSuite;

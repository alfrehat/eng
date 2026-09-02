/**
 * scripts/test-tenders-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك العطاءات والمشتريات الهندسية (Phase 05-A Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const tendersEngineService = require('../services/tendersEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runTendersTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📑 بدء الفحص الشامل لمحرك العطاءات والمشاريع الرأسمالية (Phase 05-A)');
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
  console.log('📋 1. فحص تسجيل TENDERS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('TENDERS_ENGINE');
    assert(engineEntry !== undefined, 'TENDERS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'TENDERS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('tender_crud'), 'Declared capability: tender_crud');
    assert(engineEntry && engineEntry.capabilities.includes('tender_awarding'), 'Declared capability: tender_awarding');

    const health = await engineRegistry.checkEngineHealth('TENDERS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'TENDERS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص إنشاء وتوثيق عطاء رأسمالي جديد (Tender Creation)
  // =========================================================================
  console.log('\n🏗️ 2. فحص إنشاء وتوثيق عطاء رأسمالي جديد...');
  let createdTender = null;
  try {
    createdTender = await tendersEngineService.createTender({
      name: 'عطاء فتح وتعبيد طرق بلدية كفرنجة المرحلة الخامسة',
      tenderType: 'أشغال',
      purchaseMethod: 'مناقصة عامة',
      purchaseCommittee: 'لجنة الشراء المحلية',
      estimatedValue: 120000.00,
      value: 120000.00,
      district: 'كفرنجة',
      supervisorEngineer: 'م. أحمد الفريحات',
      durationDays: 90,
      notes: 'عطاء تنموي ممول من موازنة البلدية الرأسمالية'
    }, adminUser);

    assert(createdTender && createdTender.id, `Tender created successfully with ID [${createdTender?.id}]`);
    assert(createdTender.status === 'مفتوح', 'Tender initial status is [مفتوح]');
    assert(parseFloat(createdTender.estimatedValue) === 120000, 'Estimated value accurately recorded as 120,000 JD');
  } catch (err) {
    assert(false, 'Tender creation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص الاستعلام والفلاتر (Query & Filtering)
  // =========================================================================
  console.log('\n🔍 3. فحص استرجاع قائمة العطاءات والبحث...');
  try {
    const allTenders = await tendersEngineService.getTenders({});
    assert(Array.isArray(allTenders) && allTenders.length > 0, 'getTenders returned valid list');

    const singleTender = await tendersEngineService.getTenderById(createdTender.id);
    assert(singleTender && singleTender.name === createdTender.name, 'getTenderById retrieved exact tender data');
  } catch (err) {
    assert(false, 'Tenders query failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص إحالة وترسية العطاء (Tender Awarding)
  // =========================================================================
  console.log('\n🤝 4. فحص إحالة وترسية العطاء على المقاول (Awarding)...');
  try {
    const awarded = await tendersEngineService.awardTender(createdTender.id, {
      contractor: 'شركة صقور الشمال للتعهدات الإنشائية',
      awardedValue: 115000.00,
      contractSignDate: '2026-09-01',
      commencementDate: '2026-09-10',
      durationDays: 90
    }, adminUser);

    assert(awarded && awarded.status === 'محال', 'Tender status transitioned to [محال]');
    assert(awarded.contractor === 'شركة صقور الشمال للتعهدات الإنشائية', 'Contractor accurately assigned');
    assert(parseFloat(awarded.awardedValue) === 115000, 'Awarded value accurately updated to 115,000 JD');
  } catch (err) {
    assert(false, 'Tender awarding failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء TENDERS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'TENDERS_ENGINE',
      'getTenderById',
      [createdTender.id],
      { user: engineerUser, requiredPermission: 'TENDERS.VIEW' }
    );
    assert(orchResult && orchResult.id === createdTender.id,
      'EngineOrchestrator successfully invoked TENDERS_ENGINE.getTenderById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('TENDERS.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/tenders', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/tenders', method: 'POST' };
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'العطاءات والمشاريع الرأسمالية' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'العطاءات والمشاريع الرأسمالية');
    }
    assert(auditFound === true, 'Audit log records successfully created for tender operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك العطاءات والمشتريات (Phase 05-A):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runTendersTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runTendersTestSuite;

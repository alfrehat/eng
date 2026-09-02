/**
 * scripts/test-claims-engine.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمحرك المطالبات المالية والدفعات للمقاولين (Phase 05-C Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const claimsEngineService = require('../services/claimsEngineService');
const rbacManager = require('../middlewares/rbacManager');
const { isPostgresActive, memDb } = require('../utils/database');

async function runClaimsTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('💰 بدء الفحص الشامل لمحرك المطالبات والدفعات المالية للمقاولين (Phase 05-C)');
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
  console.log('📋 1. فحص تسجيل CLAIMS_ENGINE وجاهزيته التشغيلية...');
  try {
    const engineEntry = engineRegistry.get('CLAIMS_ENGINE');
    assert(engineEntry !== undefined, 'CLAIMS_ENGINE is registered in Engine Registry');
    assert(engineEntry && engineEntry.category === 'DOMAIN_ENGINE', 'CLAIMS_ENGINE category is DOMAIN_ENGINE');
    assert(engineEntry && engineEntry.capabilities.includes('claims_crud'), 'Declared capability: claims_crud');
    assert(engineEntry && engineEntry.capabilities.includes('deductions_calculation'), 'Declared capability: deductions_calculation');
    assert(engineEntry && engineEntry.capabilities.includes('payment_certification'), 'Declared capability: payment_certification');

    const health = await engineRegistry.checkEngineHealth('CLAIMS_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'CLAIMS_ENGINE health check returned status READY');
  } catch (err) {
    assert(false, 'Engine registry verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص احتساب الاقتطاعات وصافي الدفعة (Deductions & Net Calculation)
  // =========================================================================
  console.log('\n🧮 2. فحص خوارزمية احتساب الاقتطاعات (حسن التنفيذ 10%، الضرائب، الصافي)...');
  try {
    const calc = claimsEngineService.calculateClaimDeductions(50000.00, {
      retentionPercentage: 10.0,
      advanceDeduction: 5000.00,
      taxDeduction: 1000.00
    });

    assert(calc.grossAmount === 50000, 'Gross amount is 50,000 JD');
    assert(calc.retentionValue === 5000, 'Retention 10% accurately calculated as 5,000 JD');
    assert(calc.totalDeductions === 11000, 'Total deductions sum accurately calculated as 11,000 JD');
    assert(calc.netPayable === 39000, 'Net payable accurately calculated as 39,000 JD');
  } catch (err) {
    assert(false, 'Deductions calculation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص إنشاء وتوثيق مطالبة مالية مرحلية (Claim Creation)
  // =========================================================================
  console.log('\n🏗️ 3. فحص إنشاء وتوثيق مطالبة مالية مرحلية للمقاول...');
  let createdClaim = null;
  try {
    createdClaim = await claimsEngineService.createClaim({
      tenderId: 'T-2026-065',
      contractor: 'شركة صقور الشمال للتعهدات الإنشائية',
      claimType: 'دفعة جارية رقم 1',
      amount: 40000.00,
      retentionPercentage: 10.0,
      completionPercentage: 35.0,
      notes: 'مطالبة عن إنجاز أعمال الحفريات والفرشيات وطبقة الأساس'
    }, adminUser);

    assert(createdClaim && createdClaim.id, `Claim created successfully with ID [${createdClaim?.id}]`);
    assert(createdClaim.status === 'بانتظار تدقيق المهندس المشرف', 'Claim initial status is awaiting supervisor audit');
    assert(parseFloat(createdClaim.retention) === 4000, 'Retention 10% saved as 4,000 JD');
    assert(parseFloat(createdClaim.netPayable) === 36000, 'Net payable saved as 36,000 JD');
  } catch (err) {
    assert(false, 'Claim creation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص مسار التدقيق المالي والاعتماد (Audit & Payment Certification)
  // =========================================================================
  console.log('\n✅ 4. فحص مسار التدقيق والمصادقة على صرف المطالبة...');
  try {
    const audited = await claimsEngineService.auditClaim(createdClaim.id, {
      newStatus: 'معتمدة ومصروفة',
      auditNotes: 'تم تدقيق الأعمال ومطابقتها على أرض الواقع واعتماد الصرف',
      approvedAmount: 40000.00
    }, adminUser);

    assert(audited && audited.status === 'معتمدة ومصروفة', 'Claim status transitioned to [معتمدة ومصروفة]');
    assert(audited.approvedBy !== undefined, 'Payment certificate approvedBy is recorded');
  } catch (err) {
    assert(false, 'Claim audit failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص الاستدعاء عبر منسق المحركات (EngineOrchestrator Invocation)
  // =========================================================================
  console.log('\n🎼 5. فحص استدعاء CLAIMS_ENGINE عبر EngineOrchestrator...');
  try {
    const orchResult = await engineOrchestrator.invoke(
      'CLAIMS_ENGINE',
      'getClaimById',
      [createdClaim.id],
      { user: engineerUser, requiredPermission: 'CLAIMS.VIEW' }
    );
    assert(orchResult && orchResult.id === createdClaim.id,
      'EngineOrchestrator successfully invoked CLAIMS_ENGINE.getClaimById');
  } catch (err) {
    assert(false, 'EngineOrchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص حراس الصلاحيات والأمان من جانب الخادم (401 & 403 Guards)
  // =========================================================================
  console.log('\n🔒 6. فحص حراس الصلاحيات والأمان (401 Unauthorized & 403 Forbidden)...');
  try {
    const createGuard = rbacManager.requirePermission('CLAIMS.CREATE');

    // أ. فحص 401
    let status401 = null;
    const reqNoAuth = { user: null, ip: '127.0.0.1', originalUrl: '/api/claims', method: 'POST' };
    const res401 = { status: (s) => { status401 = s; return res401; }, json: () => res401 };
    await createGuard(reqNoAuth, res401, () => {});
    assert(status401 === 401, 'Unauthenticated request strictly BLOCKED with 401 UNAUTHORIZED');

    // ب. فحص 403
    let status403 = null;
    const reqForbidden = { user: unauthorizedUser, ip: '127.0.0.1', originalUrl: '/api/claims', method: 'POST' };
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
      const logs = await require('../utils/database').dbQuery("SELECT * FROM activity_log WHERE entity = 'المطالبات والدفعات المالية' LIMIT 5");
      auditFound = logs.length > 0;
    } else {
      auditFound = (memDb.activity_log || []).some(l => l.entity === 'المطالبات والدفعات المالية');
    }
    assert(auditFound === true, 'Audit log records successfully created for claims operations');
  } catch (err) {
    assert(false, 'Audit trail verification failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك المطالبات والدفعات المالية (Phase 05-C):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runClaimsTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runClaimsTestSuite;

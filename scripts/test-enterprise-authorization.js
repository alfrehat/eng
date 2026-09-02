/**
 * scripts/test-enterprise-authorization.js
 * 🧪 سكريبت الفحص والتحقق الشامل لمنظومة الصلاحيات والتحكم الأمني المؤسسي
 * (Enterprise Authorization & Permission Enforcement Suite — Phase 02)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');
const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const { isPostgresActive, dbQuery, dbRun, memDb } = require('../utils/database');

async function runAuthorizationTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛡️  بدء الفحص الشامل لمنظومة الصلاحيات والتحكم الأمني (Enterprise RBAC Suite)');
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
  // 1️⃣ فحص جرد ونموذج الصلاحيات الموحد (Permission Inventory & Normalization)
  // =========================================================================
  console.log('📋 1. فحص جرد ونموذج الصلاحيات الموحد (Permission Inventory & Normalization)...');
  try {
    const inventory = rbacManager.PERMISSION_INVENTORY;
    assert(Array.isArray(inventory) && inventory.length >= 25, 'Permission inventory loaded with complete catalog', `Total Permissions: ${inventory.length}`);

    // فحص توحيد الصيغ
    const norm1 = rbacManager.normalizePermissionCode('tenders:create');
    const norm2 = rbacManager.normalizePermissionCode('TENDERS.CREATE');
    const norm3 = rbacManager.normalizePermissionCode('tenders.create');
    assert(norm1 === 'TENDERS.CREATE' && norm2 === 'TENDERS.CREATE' && norm3 === 'TENDERS.CREATE', 'Permission canonical normalization across all syntax variants');

    // فحص هيكل بيانات الصلاحية
    const sample = inventory.find(p => p.permissionCode === 'TENDERS.CREATE');
    const validModel = sample && sample.module === 'TENDERS' && sample.action === 'CREATE' && typeof sample.sensitive === 'boolean';
    assert(validModel, 'Unified permission model schema compliance (module, action, scope, sensitive)', `Sample: [${sample?.permissionCode}]`);
  } catch (err) {
    assert(false, 'Permission inventory failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص التحقق من الصلاحيات للأدوار الافتراضية (Static Role Matrix)
  // =========================================================================
  console.log('\n👥 2. فحص الصلاحيات للأدوار الوظيفية (Role Permissions Evaluation)...');
  try {
    // Admin has all permissions
    assert(rbacManager.hasPermission('admin', 'TENDERS.DELETE'), 'Super Admin has TENDERS.DELETE');
    assert(rbacManager.hasPermission('admin', 'CLAIMS.APPROVE'), 'Super Admin has CLAIMS.APPROVE');
    assert(rbacManager.hasPermission('admin', 'SETTINGS.MANAGE'), 'Super Admin has SETTINGS.MANAGE');

    // Quantity Surveyor has claims audit and paving calculate, but NOT roads or tenders deletion
    assert(rbacManager.hasPermission('quantity_surveyor', 'CLAIMS.AUDIT'), 'Quantity Surveyor has CLAIMS.AUDIT');
    assert(rbacManager.hasPermission('quantity_surveyor', 'claims:audit'), 'Quantity Surveyor has CLAIMS.AUDIT (legacy syntax)');
    assert(!rbacManager.hasPermission('quantity_surveyor', 'ROADS.DELETE'), 'Quantity Surveyor DOES NOT have ROADS.DELETE');
    assert(!rbacManager.hasPermission('quantity_surveyor', 'TENDERS.DELETE'), 'Quantity Surveyor DOES NOT have TENDERS.DELETE');

    // Site Inspector has field permits inspection, but NOT settings manage or claims approve
    assert(rbacManager.hasPermission('site_inspector', 'PERMITS.INSPECT'), 'Site Inspector has PERMITS.INSPECT');
    assert(!rbacManager.hasPermission('site_inspector', 'SETTINGS.MANAGE'), 'Site Inspector DOES NOT have SETTINGS.MANAGE');
    assert(!rbacManager.hasPermission('site_inspector', 'CLAIMS.APPROVE'), 'Site Inspector DOES NOT have CLAIMS.APPROVE');
  } catch (err) {
    assert(false, 'Role permissions evaluation failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص حساب الصلاحيات الفعالة ومصدر كل صلاحية (Effective Permissions)
  // =========================================================================
  console.log('\n🔍 3. فحص الصلاحيات الفعالة للمستخدمين ومصدر كل صلاحية (Effective Permissions)...');
  try {
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin', fullName: 'مدير النظام' };
    const adminEffective = await rbacManager.getEffectiveUserPermissions(adminUser);
    assert(adminEffective.isSuperAdmin === true && adminEffective.effectivePermissions.includes('*'), 'Admin effective permissions resolved as SUPER_ADMIN');

    const engUser = { id: 'U-005', username: 'roads_eng', role: 'roads_engineer', fullName: 'مهندس طرق وتنفيذ' };
    const engEffective = await rbacManager.getEffectiveUserPermissions(engUser);
    assert(!engEffective.isSuperAdmin && engEffective.effectivePermissions.includes('TENDERS.CREATE') && !engEffective.effectivePermissions.includes('SETTINGS.MANAGE'),
      'Engineer effective permissions resolved with role attribution', `Count: ${engEffective.effectivePermissions.length}`);

    const sampleDetail = engEffective.permissionDetails.find(p => p.permissionCode === 'TENDERS.CREATE');
    assert(sampleDetail && sampleDetail.granted === true && sampleDetail.source.startsWith('ROLE_'), 'Permission source attribution verified', `Source: ${sampleDetail?.source}`);
  } catch (err) {
    assert(false, 'Effective permissions failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص حارس الخادم وميدلوير الرفض 401 و 403 (Server-Side Guards)
  // =========================================================================
  console.log('\n🔒 4. فحص حراس الخادم والرفض الأمني الصارم (Server-Side Route Guards 401/403)...');
  try {
    const guard = rbacManager.requirePermission('TENDERS.DELETE');

    // أ. فحص الرفض عند غياب التوثيق -> 401
    let status401 = null;
    let json401 = null;
    const reqUnauth = { user: null };
    const res401 = {
      status: (s) => { status401 = s; return res401; },
      json: (j) => { json401 = j; return res401; }
    };
    await guard(reqUnauth, res401, () => {});
    assert(status401 === 401 && json401?.code === 'UNAUTHORIZED', 'Unauthenticated request strictly returns 401 UNAUTHORIZED');

    // ب. فحص الرفض عند عدم كفاية الصلاحية -> 403
    let status403 = null;
    let json403 = null;
    const reqForbidden = {
      user: { id: 'U-009', role: 'inspector', permissions: [] },
      ip: '127.0.0.1',
      originalUrl: '/api/tenders/TEN-2026-001',
      method: 'DELETE'
    };
    const res403 = {
      status: (s) => { status403 = s; return res403; },
      json: (j) => { json403 = j; return res403; }
    };
    await guard(reqForbidden, res403, () => {});
    assert(status403 === 403 && json403?.code === 'FORBIDDEN', 'Unauthorized request strictly returns 403 FORBIDDEN with required permission details');

    // ج. فحص السماح عند امتلاك الصلاحية -> calls next()
    let nextCalled = false;
    const reqAllowed = {
      user: { id: 'U-001', role: 'admin', permissions: ['*'] }
    };
    await guard(reqAllowed, {}, () => { nextCalled = true; });
    assert(nextCalled === true, 'Authorized user successfully passes server-side permission guard');
  } catch (err) {
    assert(false, 'Server-Side Route Guards failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص قواعد فصل المهام والمسؤوليات (Separation of Duties - SoD)
  // =========================================================================
  console.log('\n⚖️  5. فحص قواعد فصل المهام والمسؤوليات (Separation of Duties)...');
  try {
    const creatorUser = { id: 'U-005', role: 'engineer' };
    const otherUser = { id: 'U-002', role: 'manager' };
    const claimEntity = { id: 'CLM-2026-001', creatorId: 'U-005', amount: 15000 };

    const creatorCheck = rbacManager.checkSeparationOfDuties(creatorUser, claimEntity, 'APPROVE');
    assert(creatorCheck.allowed === false, 'Creator is strictly BLOCKED from approving own claim (SoD rule)', creatorCheck.reason);

    const otherCheck = rbacManager.checkSeparationOfDuties(otherUser, claimEntity, 'APPROVE');
    assert(otherCheck.allowed === true, 'Independent supervisor is ALLOWED to approve claim (SoD satisfied)');
  } catch (err) {
    assert(false, 'Separation of Duties failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص الحماية في منسق المحركات المركزي (Orchestrator Authorization)
  // =========================================================================
  console.log('\n🎼 6. فحص حماية استدعاءات منسق المحركات (Orchestrator Authorization)...');
  try {
    // أ. استدعاء مع صلاحية صحيحة
    const allowedOrch = await engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculatePciScore',
      [[]],
      { user: { id: 'U-001', role: 'admin' }, requiredPermission: 'ROADS.VIEW' }
    );
    assert(allowedOrch && allowedOrch.pciScore === 100, 'Orchestrator invocation ALLOWED with valid permission');

    // ب. استدعاء مع نقص الصلاحية -> throws FORBIDDEN
    let blockedOrch = false;
    try {
      await engineOrchestrator.invoke(
        'BUSINESS_RULES_ENGINE',
        'calculatePciScore',
        [[]],
        { user: { id: 'U-009', role: 'inspector', permissions: [] }, requiredPermission: 'SETTINGS.MANAGE' }
      );
    } catch (orchErr) {
      if (orchErr.code === 'FORBIDDEN') {
        blockedOrch = true;
        assert(true, 'Orchestrator invocation BLOCKED without required permission', orchErr.message);
      }
    }
    if (!blockedOrch) {
      assert(false, 'Orchestrator invocation was NOT blocked for unauthorized user!');
    }
  } catch (err) {
    assert(false, 'Orchestrator Authorization failure', err.message);
  }

  // =========================================================================
  // 7️⃣ فحص تسجيل محاولات الوصول المرفوضة في سجل التدقيق (Audit Logging)
  // =========================================================================
  console.log('\n📝 7. فحص توثيق القرارات الأمنية وسجل التدقيق (Security Audit Trail)...');
  try {
    const fakeReq = {
      user: { id: 'U-TEST-99', fullName: 'مستخدم تجريبي', role: 'user' },
      ip: '192.168.1.55',
      originalUrl: '/api/settings/identity',
      method: 'PUT'
    };
    await rbacManager.recordAuthAudit(fakeReq, 'SETTINGS.MANAGE', false, 'محاولة تعديل غير مصرحة');

    const activityRecords = (memDb && memDb.activity_log ? memDb.activity_log : []).filter(a => a.userId === 'U-TEST-99');
    assert(activityRecords.length > 0, 'Security denial event successfully recorded in audit log', `Log Action: ${activityRecords[0]?.action}`);
  } catch (err) {
    assert(false, 'Security Audit Trail failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص منظومة الصلاحيات والتحكم الأمني (Phase 02):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال الأمني والمؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runAuthorizationTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runAuthorizationTestSuite;

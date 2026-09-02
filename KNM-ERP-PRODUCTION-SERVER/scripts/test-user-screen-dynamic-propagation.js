/**
 * scripts/test-user-screen-dynamic-propagation.js
 * 🧪 فحص انعكاس مصفوفة الصلاحيات فورياً على شاشة وتبويبات المستخدم
 */

const http = require('http');

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء فحص انعكاس الصلاحيات اللحظي على شاشات وتبويبات المستخدمين');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. تسجيل دخول الأدمن
  const adminLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  assert(adminLogin.status === 200 && adminLogin.data.token, '1. Admin Authentication & Token');
  const adminToken = adminLogin.data.token;

  // 2. تحديث مصفوفة الصلاحيات للدور R-004 (مهندس تنفيذ أشغال)
  const targetPermissions = [
    'dashboard',
    'my-work',
    'roads',
    'roads:create',
    'roads:edit',
    'tenders',
    'tenders:create',
    'claims',
    'claims:create'
  ];

  const updateRolePerms = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/role-permissions/R-004',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { permissions: targetPermissions });

  assert(updateRolePerms.status === 200 && updateRolePerms.data.success, '2. Save & Propagate Role Permissions for R-004 (Engineer)');

  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/users/U-002',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { password: 'engineer123', role: 'engineer' });

  // 3. تسجيل دخول المستخدم المهندس (U-002 / engineer)
  const engineerLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'engineer', password: 'engineer123' });

  assert(engineerLogin.status === 200 && engineerLogin.data.token, '3. Engineer User Login Successful');
  const engineerToken = engineerLogin.data.token;
  const engineerUser = engineerLogin.data.user;

  // 4. التحقق من وصول الصلاحيات المحدثة لبيانات المستخدم المستلمة في تسجيل الدخول
  const userPermsArray = Array.isArray(engineerUser.permissions)
    ? engineerUser.permissions
    : (engineerUser.permissions || '').split(',').map(s => s.trim());

  assert(
    userPermsArray.includes('roads') || userPermsArray.includes('ROADS.VIEW'),
    '4. Engineer User Received Dynamic Roads Permission upon Login'
  );
  assert(
    userPermsArray.includes('tenders') || userPermsArray.includes('TENDERS.VIEW'),
    '5. Engineer User Received Dynamic Tenders Permission upon Login'
  );
  assert(
    userPermsArray.includes('claims:create') || userPermsArray.includes('CLAIMS.CREATE'),
    '6. Engineer User Received Dynamic Claims Creation Permission upon Login'
  );

  // 5. فحص endpoint الصلاحيات الفعالة اللحظية (/api/auth/my-permissions)
  const myPerms = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/auth/my-permissions',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${engineerToken}`
    }
  });

  assert(myPerms.status === 200 && myPerms.data.success, '7. Endpoint /api/auth/my-permissions Responded Successfully');
  const effectivePerms = myPerms.data.effectivePermissions || [];

  assert(
    effectivePerms.includes('ROADS.VIEW') || effectivePerms.includes('roads'),
    '8. Effective Permissions contain Roads module access'
  );

  assert(
    effectivePerms.includes('TENDERS.VIEW') || effectivePerms.includes('tenders'),
    '9. Effective Permissions contain Tenders module access'
  );

  assert(
    effectivePerms.includes('CLAIMS.CREATE') || effectivePerms.includes('claims:create'),
    '10. Effective Permissions contain Claims creation access'
  );

  assert(
    !effectivePerms.includes('SETTINGS.MANAGE') && !effectivePerms.includes('settings:manage'),
    '11. Unauthorized Settings Manage properly restricted from Engineer'
  );

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});

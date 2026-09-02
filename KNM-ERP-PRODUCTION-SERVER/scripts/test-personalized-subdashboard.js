/**
 * scripts/test-personalized-subdashboard.js
 * 🧪 اختبار لوحة التحكم الفرعية المخصصة بحسب الصلاحيات المنوطة بالمستخدم
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
  console.log('🏛️  بدء فحص لوحة التحكم الفرعية المخصصة بحسب الصلاحيات المنوطة بالمستخدم');
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

  // 1. تسجيل دخول مدير النظام
  const adminLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  assert(adminLogin.status === 200 && adminLogin.data.token, '1. Admin Authentication & Token Generation');
  const adminToken = adminLogin.data.token;

  // 2. تحديث صلاحيات دور المهندس (R-004) لتشمل الطرق والعطاءات فقط
  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/role-permissions/R-004',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    permissions: [
      'dashboard',
      'my-work',
      'roads',
      'roads:create',
      'roads:edit',
      'tenders',
      'tenders:create'
    ]
  });

  // 3. تحديث صلاحيات دور المحاسب (R-005) لتشمل المطالبات والمشتريات فقط
  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/role-permissions/R-005',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    permissions: [
      'dashboard',
      'claims',
      'claims:create',
      'claims:audit',
      'purchases',
      'purchases:create'
    ]
  });

  // تعيين كلمات مرور معروفة للاختبار
  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/users/U-002',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { password: 'engineer123', role: 'engineer' });

  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/users/U-005',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { password: 'accountant123', role: 'accountant' });

  // 4. تسجيل دخول المهندس وفحص الصلاحيات المنوطة به
  const engLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'engineer', password: 'engineer123' });

  assert(engLogin.status === 200 && engLogin.data.token, '2. Engineer Login Successful');
  const engToken = engLogin.data.token;

  const engPerms = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/auth/my-permissions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${engToken}` }
  });

  assert(engPerms.status === 200 && engPerms.data.success, '3. Engineer Fetched Effective Permissions');
  const engList = engPerms.data.effectivePermissions || [];

  assert(
    engList.includes('ROADS.VIEW') || engList.includes('roads'),
    '4. Engineer Dashboard has access to Roads module'
  );
  assert(
    engList.includes('TENDERS.VIEW') || engList.includes('tenders'),
    '5. Engineer Dashboard has access to Tenders module'
  );
  assert(
    !engList.includes('CLAIMS.VIEW') && !engList.includes('claims'),
    '6. Engineer Dashboard strictly hides Claims module'
  );
  assert(
    !engList.includes('PURCHASES.VIEW') && !engList.includes('purchases'),
    '7. Engineer Dashboard strictly hides Purchases module'
  );

  // 5. تسجيل دخول المحاسب وفحص الصلاحيات المنوطة به
  const accLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'accountant', password: 'accountant123' });

  assert(accLogin.status === 200 && accLogin.data.token, '8. Accountant Login Successful');
  const accToken = accLogin.data.token;

  const accPerms = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/auth/my-permissions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accToken}` }
  });

  assert(accPerms.status === 200 && accPerms.data.success, '9. Accountant Fetched Effective Permissions');
  const accList = accPerms.data.effectivePermissions || [];

  assert(
    accList.includes('CLAIMS.VIEW') || accList.includes('claims'),
    '10. Accountant Dashboard has access to Claims module'
  );
  assert(
    accList.includes('PURCHASES.VIEW') || accList.includes('purchases'),
    '11. Accountant Dashboard has access to Purchases module'
  );
  assert(
    !accList.includes('ROADS.VIEW') && !accList.includes('roads'),
    '12. Accountant Dashboard strictly hides Roads module'
  );
  assert(
    !accList.includes('TENDERS.VIEW') && !accList.includes('tenders'),
    '13. Accountant Dashboard strictly hides Tenders module'
  );

  // 6. التحقق من نقطة الإحصائيات العامة الموحدة
  const statsRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/stats',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${engToken}` }
  });

  assert(statsRes.status === 200, '14. Unified Municipal KPI Statistics API Accessible');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});

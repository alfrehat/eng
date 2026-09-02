/**
 * scripts/test-strict-ui-and-api-isolation.js
 * 🧪 اختبار الحظر والعزل التام للشاشات والعمليات غير المصرحة
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
  console.log('🏛️  بدء فحص الحظر الصارم والإخفاء التام للشاشات والعمليات غير المصرحة');
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

  assert(adminLogin.status === 200 && adminLogin.data.token, '1. Admin Authentication');
  const adminToken = adminLogin.data.token;

  // 2. تعيين صلاحيات مقيدة لدور المهندس R-004 (الطرق والعطاءات فقط)
  await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/role-permissions/R-004',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    permissions: ['dashboard', 'my-work', 'roads', 'roads:create', 'tenders', 'tenders:create']
  });

  // 3. تسجيل دخول المهندس
  const engLogin = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'engineer', password: 'engineer123' });

  assert(engLogin.status === 200 && engLogin.data.token, '2. Engineer Authentication');
  const engToken = engLogin.data.token;

  // 4. استرجاع الصلاحيات الفعالة للمهندس
  const engPerms = await httpRequest({
    hostname: '127.0.0.1',
    port: 3005,
    path: '/api/auth/my-permissions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${engToken}` }
  });

  assert(engPerms.status === 200 && engPerms.data.success, '3. Effective Permissions Endpoint Verified');
  const perms = engPerms.data.effectivePermissions || [];

  // 5. التحقق من تواجد الصلاحيات المصرحة فقط
  assert(perms.includes('roads') || perms.includes('ROADS.VIEW'), '4. Roads permission granted to Engineer');
  assert(perms.includes('tenders') || perms.includes('TENDERS.VIEW'), '5. Tenders permission granted to Engineer');

  // 6. التحقق الصارم من انعدام أي صلاحيات غير منوطة
  assert(!perms.includes('claims') && !perms.includes('CLAIMS.VIEW'), '6. Claims permission strictly absent for Engineer');
  assert(!perms.includes('purchases') && !perms.includes('PURCHASES.VIEW'), '7. Purchases permission strictly absent for Engineer');
  assert(!perms.includes('settings') && !perms.includes('SETTINGS.VIEW') && !perms.includes('SETTINGS.MANAGE'), '8. Settings & Admin management strictly absent for Engineer');
  assert(!perms.includes('users:manage') && !perms.includes('USERS.MANAGE'), '9. User management strictly absent for Engineer');
  assert(!perms.includes('roles:manage') && !perms.includes('ROLES.MANAGE'), '10. Role matrix management strictly absent for Engineer');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});

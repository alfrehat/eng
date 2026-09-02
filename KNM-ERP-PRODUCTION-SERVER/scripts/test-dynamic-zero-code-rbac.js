/**
 * scripts/test-dynamic-zero-code-rbac.js
 * 🏛️ فحص محرك الأدوار والصلاحيات الديناميكي الشامل (Zero-Code Dynamic RBAC Engine)
 * التحقق من إمكانية إنشاء وتعديل وحذف أي دور وظيفي وتخصيص صلاحياته من الواجهات ومزامنته فورياً
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3106;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer(maxAttempts = 25, interval = 300) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await makeRequest('GET', '/api/health');
      if (res.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

async function runZeroCodeRBACTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء فحص محرك الأدوار والصلاحيات الديناميكي الشامل (Zero-Code Dynamic RBAC)');
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

  try {
    // 1. تسجيل الدخول كمدير النظام
    const adminLogin = await makeRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert(adminLogin.status === 200 && adminLogin.data?.token, 'Admin Auth & Token');
    const adminToken = adminLogin.data.token;

    // 2. إنشاء دور وظيفي جديد كلياً عبر الـ API (محاكاة الواجهة)
    console.log('\n➕ 2. اختبار إنشاء دور وظيفي ديناميكي جديد بالكامل (Zero-Code Role Creation)...');
    const uniqueSuffix = Date.now().toString().slice(-4);
    const dynamicRoleName = `quality_specialist_${uniqueSuffix}`;
    const createRoleRes = await makeRequest('POST', '/api/roles', {
      name: dynamicRoleName,
      label: 'أخصائي ضبط الجودة الميداني',
      description: 'متابعة تقارير فحص الجودة والمواد الإنشائية'
    }, adminToken);
    assert(createRoleRes.status === 201 && createRoleRes.data?.id, 'Create New Dynamic Role via API/UI', `Role ID: ${createRoleRes.data?.id}`);
    const dynamicRoleId = createRoleRes.data?.id;

    // 3. إسناد مصفوفة صلاحيات للدور الجديد
    console.log('\n🔑 3. إسناد مصفوفة صلاحيات دقيقة للدور الجديد عبر واجهة الصلاحيات...');
    const assignPermsRes = await makeRequest('POST', `/api/role-permissions/${dynamicRoleId}`, {
      permissions: ['dashboard', 'roads', 'tasks', 'roads:create', 'tasks:create']
    }, adminToken);
    assert(assignPermsRes.status === 200 && assignPermsRes.data?.success, 'Assign Custom Permissions to Dynamic Role');

    // 4. إنشاء مستخدم وربطه بالدور الجديد
    console.log('\n👤 4. إنشاء مستخدم وتعيين الدور الديناميكي الجديد له...');
    const dynamicUsername = `user.quality.${uniqueSuffix}`;
    const createUserRes = await makeRequest('POST', '/api/users', {
      username: dynamicUsername,
      password: 'QualityPassword123!',
      fullName: 'م. حسام فريحات - أخصائي جودة',
      role: dynamicRoleName,
      department: 'قسم الطرق والبنية التحتية'
    }, adminToken);
    assert(createUserRes.status === 201 && createUserRes.data?.id, 'Create User Assigned to Dynamic Role', `User ID: ${createUserRes.data?.id}`);
    const dynamicUserId = createUserRes.data?.id;

    // 5. تسجيل الدخول بالمستخدم الجديد وفحص مصفوفة صلاحياته الموروثة ديناميكياً
    console.log('\n🔐 5. توثيق جلسة المستخدم وفحص توريث الصلاحيات اللحظي دون أي كود مسبق...');
    const userLogin = await makeRequest('POST', '/api/login', {
      username: dynamicUsername,
      password: 'QualityPassword123!'
    });
    assert(userLogin.status === 200 && userLogin.data?.token, 'User Login with Dynamic Role');
    const userToken = userLogin.data?.token;

    // فحص وصول المستخدم للشاشات المصرح له بها
    const roadsAccess = await makeRequest('GET', '/api/roads', null, userToken);
    assert(roadsAccess.status === 200, 'Access Granted to Permitted Screen (Roads)');

    // 6. تعديل الصلاحيات الممنوحة للدور ديناميكياً وإضافة شاشة العطاءات
    console.log('\n🔄 6. اختبار التعديل الفوري لمصفوفة الصلاحيات من الواجهة (Instant Dynamic Propagation)...');
    const updatePermsRes = await makeRequest('POST', `/api/role-permissions/${dynamicRoleId}`, {
      permissions: ['dashboard', 'roads', 'tasks', 'tenders', 'roads:create', 'tasks:create', 'tenders:create']
    }, adminToken);
    assert(updatePermsRes.status === 200 && updatePermsRes.data?.success, 'Dynamically Expand Role Permissions in Database');

    // 7. تنظيف المستخدم والدور التجريبي
    console.log('\n🧹 7. تنظيف السجلات الاختبارية...');
    const deleteUserRes = await makeRequest('DELETE', `/api/users/${dynamicUserId}`, null, adminToken);
    assert(deleteUserRes.status === 200, 'Delete Test User');

    const deleteRoleRes = await makeRequest('DELETE', `/api/roles/${dynamicRoleId}`, null, adminToken);
    assert(deleteRoleRes.status === 200, 'Delete Dynamic Role');

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log(`📊 نتيجة اختبار محرك الأدوار والصلاحيات الديناميكي (Zero-Code RBAC Engine):`);
    console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
    console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
    console.log(`   🎯 نسبة نجاح المحرك: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    return { passed, failed };
  } catch (e) {
    console.error('💥 Zero-Code RBAC Test Error:', e);
    return { passed, failed: failed + 1 };
  }
}

async function startSuite() {
  const serverProc = spawn('node', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(TEST_PORT), HOST: '127.0.0.1' })
  });
  serverProc.stdout.on('data', () => {});
  serverProc.stderr.on('data', () => {});

  try {
    const ready = await waitForServer();
    if (!ready) throw new Error('Server failed to start on test port ' + TEST_PORT);
    return await runZeroCodeRBACTests();
  } finally {
    serverProc.kill();
  }
}

if (require.main === module) {
  startSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = startSuite;

/**
 * scripts/test-users-rbac-reengineering.js
 * 🏛️ فحص شامل لإعادة هيكلة المحرك المركزي لإدارة المستخدمين والصلاحيات والأدوار (Central RBAC Suite)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3107;
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

async function runUsersRbacTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء فحص المحرك المركزي لإدارة المستخدمين والصلاحيات والأدوار (Central RBAC Suite)');
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
    // 1. تسجيل الدخول بحساب مدير النظام
    console.log('🔑 1. توثيق جلسة مدير النظام...');
    const loginRes = await makeRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert(loginRes.status === 200 && loginRes.data?.token, 'Admin Authentication & Token Generation');
    const token = loginRes.data?.token;

    // 2. استرجاع قائمة المستخدمين والتحقق من نقاء الحسابات
    console.log('\n👥 2. فحص قائمة المستخدمين والأدوار الرسمية...');
    const usersRes = await makeRequest('GET', '/api/users', null, token);
    assert(usersRes.status === 200 && Array.isArray(usersRes.data), 'Get Users List', `Count: ${usersRes.data?.length}`);
    const validRoles = [
      'admin', 'director_public_works', 'head_of_roads', 'head_of_buildings',
      'roads_engineer', 'buildings_engineer', 'quantity_surveyor',
      'site_inspector', 'qa_qc_engineer', 'land_surveyor'
    ];
    const allUsersHaveValidRoles = usersRes.data.every(u => validRoles.includes(u.role));
    assert(allUsersHaveValidRoles, 'All users strictly bound to official roles (Zero undefined roles)');

    // 3. إنشاء مستخدم جديد عبر المحرك المركزي
    console.log('\n➕ 3. اختبار إضافة مستخدم جديد وتحديد الصلاحيات...');
    const newUsername = `eng.test.${Date.now().toString().slice(-4)}`;
    const createRes = await makeRequest('POST', '/api/users', {
      username: newUsername,
      password: 'password123',
      fullName: 'م. إبراهيم فريحات - مهندس إشراف مساعد',
      role: 'roads_engineer',
      department: 'قسم الطرق والبنية التحتية',
      job_title: 'مهندس تنفيذ طرق',
      permissions: ['dashboard', 'roads', 'tasks', 'roads:create']
    }, token);
    assert(createRes.status === 201 && createRes.data?.id, 'Create User with Custom Permissions', `New User ID: ${createRes.data?.id}`);
    const newUserId = createRes.data?.id;

    // 4. تعديل بيانات المستخدم والصلاحيات
    console.log('\n✏️ 4. اختبار تعديل بيانات وصلاحيات المستخدم...');
    const updateRes = await makeRequest('PUT', `/api/users/${newUserId}`, {
      fullName: 'م. إبراهيم فريحات - مهندس مشاريع معتمد',
      role: 'engineer',
      job_title: 'مهندس مشاريع رئيسي'
    }, token);
    assert(updateRes.status === 200 && updateRes.data?.success, 'Update User Profile');

    // 5. قراءة وتحديث الصلاحيات التفصيلية
    console.log('\n🔑 5. اختبار تخصيص الصلاحيات المحددة للمستخدم...');
    const getPermsRes = await makeRequest('GET', `/api/users/${newUserId}/permissions`, null, token);
    assert(getPermsRes.status === 200 && Array.isArray(getPermsRes.data?.permissions), 'Get User Custom Permissions');

    const updatePermsRes = await makeRequest('PUT', `/api/users/${newUserId}/permissions`, {
      permissions: ['dashboard', 'roads', 'tasks', 'tenders', 'claims', 'roads:create', 'claims:create']
    }, token);
    assert(updatePermsRes.status === 200 && updatePermsRes.data?.success, 'Set Granular Custom Permissions');

    // 6. إنشاء مستخدم مصدر لاختبار وظيفة دمج الحسابات (Merge Accounts)
    console.log('\n🔀 6. اختبار وظيفة دمج الحسابات ونقل المهام والصلاحيات...');
    const sourceUsername = `source.user.${Date.now().toString().slice(-4)}`;
    const createSourceRes = await makeRequest('POST', '/api/users', {
      username: sourceUsername,
      password: 'password123',
      fullName: 'م. مستخدم تجريبي للدمج',
      role: 'inspector',
      department: 'قسم الرقابة والتفتيش الميداني',
      permissions: ['dashboard', 'tasks', 'roads']
    }, token);
    const sourceUserId = createSourceRes.data?.id;

    // إسناد مهمة للمستخدم المصدر
    const taskRes = await makeRequest('POST', '/api/tasks', {
      title: 'مهمة فحص ميداني لنقلها بالدمج',
      assignedTo: 'م. مستخدم تجريبي للدمج',
      priority: 'عالية'
    }, token);
    assert(taskRes.status === 200 || taskRes.status === 201, 'Assign Task to Source User');

    // تنفيذ عملية الدمج
    const mergeRes = await makeRequest('POST', '/api/users/merge', {
      sourceUserId,
      targetUserId: newUserId,
      action: 'MERGE'
    }, token);
    assert(mergeRes.status === 200 && mergeRes.data?.success, 'Merge Users & Transfer Tasks/Permissions Successfully');

    // التحقق من حذف المستخدم المصدر بعد الدمج
    const checkSourceRes = await makeRequest('GET', `/api/users/${sourceUserId}`, null, token);
    assert(checkSourceRes.status === 404, 'Source User successfully purged after merge');

    // 7. اختبار حماية الحساب الجذري لمدير النظام من الحذف
    console.log('\n🛡️ 7. اختبار الحماية الأمنية لحساب مدير النظام الرئيسي (U-001)...');
    const deleteAdminRes = await makeRequest('DELETE', '/api/users/U-001', null, token);
    assert(deleteAdminRes.status === 400, 'Protected Super-Admin (U-001) cannot be deleted');

    // 8. حذف المستخدم الاختباري وتنظيف البيانات
    console.log('\n🗑️ 8. اختبار حذف المستخدم وتنظيف البيانات الاختبارية...');
    const deleteRes = await makeRequest('DELETE', `/api/users/${newUserId}`, null, token);
    assert(deleteRes.status === 200 && deleteRes.data?.success, 'Delete User Successfully');

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log(`📊 النتيجة الإجمالية لفحص المحرك المركزي للمستخدمين والصلاحيات:`);
    console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
    console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
    console.log(`   🎯 نسبة نجاح المحرك: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    return { passed, failed };
  } catch (err) {
    console.error('💥 Users RBAC Test Error:', err);
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
    return await runUsersRbacTests();
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

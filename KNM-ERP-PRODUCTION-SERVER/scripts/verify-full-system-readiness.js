const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

async function testFullSystemReadiness() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ بدء التحقق الشامل من جاهزية وتفعيل النظام والعرض والأرشفة الرقمية');
  console.log('🏢 بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. فحص سلامة وتكامل كافة ملفات واجهات المستخدم (Frontend Script Integrity)
  console.log('🖥️ 1. فحص تكامل ملفات واجهات المستخدم والمديرين (UI Managers)...');
  const scriptsToCheck = [
    'services/engineToUiRegistry.js',
    'GIS/Pages/unifiedGisEngine.js',
    'Settings/Pages/unifiedSettingsManager.js',
    'Settings/Pages/visualTemplateBuilder.js',
    'Reports/Pages/printEngine.js',
    'Reports/Pages/unifiedPrintTemplatesManager.js',
    'Roads/Pages/unifiedRoadsManager.js',
    'Assets/Pages/structuralAssets.js',
    'Assets/Pages/infrastructureNetworks.js',
    'Assets/Pages/energyLighting.js',
    'Administration/Pages/excavationPermits.js',
    'PavementReturns/Pages/pavingReturns.js',
    'Contracts/Pages/contracts.js',
    'Contracts/Pages/unifiedContractManagementManager.js',
    'Contracts/Pages/unifiedClaimsManager.js',
    'Purchases/Pages/unifiedPurchasesManager.js',
    'Tenders/Pages/unifiedTendersManager.js',
    'js/budgetManager.js',
    'Archive/Pages/unifiedArchiveManager.js',
    'Committees/Pages/unifiedCommitteesManager.js',
    'Projects/Pages/unifiedProjectsManager.js',
    'Projects/Pages/enterpriseProjectWorkspace.js',
    'app.js'
  ];

  for (const s of scriptsToCheck) {
    const fullPath = path.join(__dirname, '..', s);
    const exists = fs.existsSync(fullPath);
    assert(exists, `الملف البرمجي موجود: ${s}`);
  }

  // 2. فحص تسجيل الدخول وتوليد التوكن
  console.log('\n🔑 2. فحص تسجيل الدخول وتوليد رمز المصادقة (JWT Token)...');
  const loginRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost',
      port: 3005,
      path: '/api/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(postData);
    req.end();
  });

  const token = loginRes?.token;
  assert(Boolean(token), 'تم تسجيل الدخول واستلام JWT Token بنجاح');

  // 3. فحص منظومة الأرشفة الرقمية والتوثيق
  console.log('\n🗄️ 3. فحص منظومة الأرشفة والتوثيق الرقمي (Archive & Document Engine)...');
  const archiveStats = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 3005,
      path: '/api/archive/stats',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
  assert(archiveStats?.success === true, 'استرجاع إحصائيات الأرشيف الرقمي بنجاح');

  const verifyBrowse = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 3005,
      path: '/api/v4/verify-document/browse/all',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
  assert(verifyBrowse?.success === true, 'محرك التحقق الرقمي الموحد والختم الأمني نشط');

  // 4. فحص الإعدادات والهوية البصرية الرسمية
  console.log('\n⚙️ 4. فحص إعدادات الهوية المؤسسية للبلدية...');
  const settingsRes = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 3005,
      path: '/api/settings/identity',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
  const dataObj = settingsRes?.data || settingsRes || {};
  const muniName = dataObj.municipality_name || dataObj.nameAr || dataObj.app_title;
  assert(Boolean(muniName), `اسم المؤسسة معتمد: ${muniName}`);

  // 6. فحص البث الحي اللحظي عبر الـ WebSockets
  console.log('\n⚡ 6. فحص قناة البث الحي (WebSockets Live Channel)...');
  await new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3005/ws');
    ws.on('open', () => {
      assert(true, 'تم الاتصال بقناة البث الحي اللحظي ws://localhost:3005/ws');
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      assert(false, 'فشل الاتصال بـ WebSocket: ' + err.message);
      resolve();
    });
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة النهائية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

testFullSystemReadiness();

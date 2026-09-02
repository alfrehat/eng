/**
 * scripts/test-backup-restore-suite.js
 * فحص نظام النسخ الاحتياطي المشفر بـ AES-256 والاسترجاع والصلاحيات
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3005';

function apiRequest(method, endpoint, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body = data ? JSON.stringify(data) : null;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(url, { method, headers }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(rawData); } catch (e) { parsed = rawData; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runBackupTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء فحص وتأكيد نظام النسخ الاحتياطي المشفر بـ AES-256 والاسترجاع والصلاحيات');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;

  // 1. فحص حماية المسارات غير المصرح بها
  console.log('🔒 1. اختبار حماية مسارات النسخ الاحتياطي من الوصول غير المصرح به...');
  const unauthRes = await apiRequest('POST', '/api/v4/admin/trigger-backup', null, null);
  assert(unauthRes.status === 401 || unauthRes.status === 403, 'Unauthenticated backup trigger must be rejected');
  console.log('  ✅ [PASS] Unauthenticated access rejected successfully (401/403)');
  passed++;

  // 2. تسجيل دخول مدير النظام
  console.log('\n🔑 2. توثيق جلسة مدير النظام...');
  const loginRes = await apiRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert(loginRes.status === 200 && loginRes.data.token, 'Login failed');
  const token = loginRes.data.token;
  console.log('  ✅ [PASS] Admin Auth & JWT Token Generated');
  passed++;

  // 3. توليد نسخة احتياطية مشفرة فورية بـ AES-256
  console.log('\n📦 3. اختبار توليد نسخة احتياطية مشفرة بـ AES-256 (Instant Trigger)...');
  const triggerRes = await apiRequest('POST', '/api/v4/admin/trigger-backup', null, token);
  assert(triggerRes.status === 200 && triggerRes.data.success, 'Trigger backup failed');
  assert(triggerRes.data.data.filename.endsWith('.enc'), 'Backup file must be encrypted .enc');
  const createdFilename = triggerRes.data.data.filename;
  console.log(`  ✅ [PASS] Encrypted Backup Created Successfully: ${createdFilename} (Size: ${triggerRes.data.data.sizeKb} KB)`);
  passed++;

  // 4. استعلام قائمة وأرشيف النسخ الاحتياطية
  console.log('\n🗄️ 4. فحص أرشيف النسخ الاحتياطية المحفوظة...');
  const listRes = await apiRequest('GET', '/api/v4/admin/backups-list', null, token);
  assert(listRes.status === 200 && Array.isArray(listRes.data.data), 'Backups list failed');
  const found = listRes.data.data.some(b => b.filename === createdFilename);
  assert(found, 'Created backup must appear in the backups list');
  console.log(`  ✅ [PASS] Backups Archive Listed Successfully (Count: ${listRes.data.data.length})`);
  passed++;

  // 5. تنزيل ملف النسخة الاحتياطية المشفرة
  console.log('\n⬇️ 5. اختبار تنزيل ملف النسخة المشفرة...');
  const downloadRes = await apiRequest('GET', `/api/v4/admin/download-backup/${createdFilename}`, null, token);
  assert(downloadRes.status === 200, 'Download backup failed');
  assert(downloadRes.data.salt && downloadRes.data.iv && downloadRes.data.data, 'Backup must contain AES-256 crypto envelope');
  console.log('  ✅ [PASS] Encrypted File Downloaded & Verified (AES-256 Envelope Intact)');
  passed++;

  // 6. اختبار استرجاع وفك تشفير قاعدة البيانات
  console.log('\n🔄 6. اختبار استرجاع وفك تشفير قاعدة البيانات من النسخة الاحتياطية...');
  const restoreRes = await apiRequest('POST', '/api/v4/admin/restore-backup', downloadRes.data, token);
  assert(restoreRes.status === 200 && restoreRes.data.success, 'Restore backup failed');
  console.log(`  ✅ [PASS] Decryption & Database Restore Completed Successfully (Restored Tables: ${restoreRes.data.data.restoredTables})`);
  passed++;

  // 7. اختبار حذف النسخة الاحتياطية
  console.log('\n🗑️ 7. اختبار حذف ملف النسخة الاحتياطية بعد التحقق...');
  const deleteRes = await apiRequest('DELETE', `/api/v4/admin/delete-backup/${createdFilename}`, null, token);
  assert(deleteRes.status === 200 && deleteRes.data.success, 'Delete backup failed');
  console.log('  ✅ [PASS] Backup File Deleted Cleanly');
  passed++;

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 نتيجة فحص نظام النسخ الاحتياطي والأمان (AES-256 Backup & Restore Suite):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: 0`);
  console.log(`   🎯 نسبة نجاح النظام: 100%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

runBackupTestSuite().catch(err => {
  console.error('💥 Backup Test Suite Failed:', err);
  process.exit(1);
});

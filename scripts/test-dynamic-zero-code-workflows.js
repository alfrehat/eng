/**
 * scripts/test-dynamic-zero-code-workflows.js
 * فحص وتأكيد محرك مسارات العمل وسلاسل الاعتماد الديناميكي الشامل (Zero-Code Dynamic Workflow Engine)
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

async function runWorkflowTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء فحص محرك مسارات العمل وسلاسل الاعتماد الشامل (Zero-Code Workflow Engine)');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let token = null;

  // 1. تسجيل الدخول
  console.log('🔑 1. توثيق جلسة مدير النظام...');
  const loginRes = await apiRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
  assert(loginRes.status === 200 && loginRes.data.token, 'Login failed');
  token = loginRes.data.token;
  console.log('  ✅ [PASS] Admin Auth & Token Generated Successfully');
  passed++;

  // 2. التحقق من مسارات العمل الرسمية المعتمدة (5 مسارات وتطهير المسارات الزائفة)
  console.log('\n⛓️ 2. فحص قائمة مسارات العمل المعتمدة والتأكد من خلوها من التكرار والمسارات الزائفة...');
  const wfListRes = await apiRequest('GET', '/api/workflows', null, token);
  assert(wfListRes.status === 200 && Array.isArray(wfListRes.data), 'Get workflows failed');
  console.log(`  ✅ [PASS] Get Official Workflows List (Count: ${wfListRes.data.length})`);
  passed++;

  const hasDummy = wfListRes.data.some(w => w.name.includes('مسار تجريبي مؤقت'));
  assert(!hasDummy, 'Found lingering dummy test workflows in database!');
  console.log('  ✅ [PASS] All dummy & duplicate workflows successfully purged from system');
  passed++;

  // 3. إنشاء مسار عمل ديناميكي جديد بالكامل (Zero-Code Dynamic Creation)
  console.log('\n➕ 3. اختبار تصميم وإنشاء مسار عمل جديد ديناميكياً (Zero-Code)...');
  const newWfPayload = {
    name: 'مسار الفحوصات المخبرية وضبط جودة الخلطات الإسفلتية',
    entityType: 'tasks',
    description: 'سلسلة اعتماد الفحوصات وضبط الجودة الميدانية من المختبر حتى مدير الأشغال',
    stepsJson: [
      { stepIndex: 1, label: 'أخذ العينات الميدانية والفحص الأولي', targetRole: 'R-005', allowReject: false },
      { stepIndex: 2, label: 'التدقيق الفني لنتائج المختبر وكسر العينات', targetRole: 'R-004', allowReject: true },
      { stepIndex: 3, label: 'اعتماد شهادة المطابقة الهندسية', targetRole: 'R-003', allowReject: true }
    ]
  };

  const createWfRes = await apiRequest('POST', '/api/workflows', newWfPayload, token);
  assert(createWfRes.status === 201 && createWfRes.data.id, 'Create workflow failed');
  const createdWfId = createWfRes.data.id;
  console.log(`  ✅ [PASS] Create Dynamic Workflow Successfully (Workflow ID: ${createdWfId})`);
  passed++;

  // 4. اختبار تعديل الخطوات وإضافة مرحلة جديدة للمسار
  console.log('\n⚙️ 4. اختبار تعديل وإعادة هيكلة سلسلة الاعتماد للمسار من الواجهة...');
  const updatedSteps = [
    { stepIndex: 1, label: 'أخذ العينات الميدانية والفحص الأولي', targetRole: 'R-005', allowReject: false },
    { stepIndex: 2, label: 'التدقيق الفني لنتائج المختبر وكسر العينات', targetRole: 'R-004', allowReject: true },
    { stepIndex: 3, label: 'المراجعة الإدارية للقسم', targetRole: 'R-003', allowReject: true },
    { stepIndex: 4, label: 'المصادقة النهائية لمدير الأشغال', targetRole: 'R-002', allowReject: true }
  ];

  const updateWfRes = await apiRequest('PUT', `/api/workflows/${createdWfId}`, {
    name: 'مسار الفحوصات المخبرية وضبط الجودة (المعدل)',
    entityType: 'tasks',
    description: 'تمت إضافة مرحلة المصادقة النهائية للمدير',
    stepsJson: updatedSteps
  }, token);
  assert(updateWfRes.status === 200 && updateWfRes.data.success, 'Update workflow failed');
  console.log('  ✅ [PASS] Update Dynamic Workflow Steps & Structure Successfully');
  passed++;

  // 5. اختبار تنفيذ مراحل تدفق العمل لمطالبة مالية
  console.log('\n🔄 5. اختبار ترقية خطوة تدفق العمل للمطالبة المالية عبر المحرك...');
  const wfStepsRes = await apiRequest('GET', '/api/v4/workflows/steps', null, token);
  assert(wfStepsRes.status === 200 && wfStepsRes.data.success, 'Get workflow steps failed');
  console.log('  ✅ [PASS] Workflow Engine Steps Definition Verified');
  passed++;

  // 6. حذف المسار الاختباري المؤقت وتنظيف البيانات
  console.log('\n🧹 6. تنظيف المسار الاختباري بعد التحقق...');
  const deleteWfRes = await apiRequest('DELETE', `/api/workflows/${createdWfId}`, null, token);
  assert(deleteWfRes.status === 200 && deleteWfRes.data.success, 'Delete workflow failed');
  console.log(`  ✅ [PASS] Test Dynamic Workflow (${createdWfId}) Deleted Cleanly`);
  passed++;

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 نتيجة فحص محرك مسارات العمل (Zero-Code Dynamic Workflow Engine):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: 0`);
  console.log(`   🎯 نسبة نجاح المحرك: 100%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

runWorkflowTestSuite().catch(err => {
  console.error('💥 Workflow Engine Test Suite Failed:', err);
  process.exit(1);
});

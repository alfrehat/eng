/**
 * scripts/test-e2e-integration.js
 * 🏛️ سكريبت محاكاة واختبار سيناريوهات دورة العمل المتكاملة من البداية للنهاية (End-to-End Integration Suite)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

async function runE2EIntegrationTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء المرحلة الثالثة: اختبار سيناريوهات دورة العمل الكاملة (E2E Full Lifecycle)');
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
    // 1. تسجيل الدخول والحصول على رمز JWT
    console.log('🔑 1. توثيق جلسة مدير مديرية الأشغال والخدمات الهندسية...');
    const loginRes = await makeRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
    assert(loginRes.status === 200 && loginRes.data?.token, 'Admin Authentication & Token Generation');
    const token = loginRes.data?.token;

    // 2. التحقق من اتصال البث الحي WebSockets
    console.log('\n⚡ 2. فتح قناة البث الحي اللحظي (WebSockets Listening)...');
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${token}`);
    await new Promise((resolve) => {
      ws.on('open', () => {
        assert(true, 'WebSocket Connection established on /ws');
        resolve();
      });
      setTimeout(resolve, 1000);
    });

    // =========================================================================
    // السيناريو الأول: دورة حياة المشروع البلدي الكاملة
    // (طرح عطاء ⬅️ إبرام عقد ⬅️ كفالات ⬅️ أمر مباشرة ⬅️ مطالبة ⬅️ اعتماد ثلاثي ⬅️ أمر تغيير ⬅️ أرشفة وتوثيق)
    // =========================================================================
    console.log('\n🏗️  3. بدء السيناريو الأول: دورة حياة المشروع الإنشائي المتكامل...');
    
    // أ. طرح عطاء جديد
    const tenderPayload = {
      name: 'مشروع إنشاء جدران استنادية وتوسعة طريق وادي كفرنجة السياحي',
      contractor: 'ائتلاف شركات الشمال للمقاولات الإنشائية',
      estimatedValue: 180000,
      awardedValue: 175000,
      value: 175000,
      status: 'جاري التنفيذ',
      commencementDate: new Date().toISOString().split('T')[0],
      durationDays: 120,
      lat: 32.2995,
      lng: 35.7042,
      district: 'كفرنجة'
    };
    const createTender = await makeRequest('POST', '/api/tenders', tenderPayload, token);
    const actualTenderId = createTender.data?.id;
    assert((createTender.status === 200 || createTender.status === 201) && actualTenderId, 'Tender Creation & Atomic Code Sequencing', `Tender ID: ${actualTenderId}`);

    // ب. إبرام العقد وتسجيل الكفالات البنكية
    const contractId = `CNT-2026-E2E-${Date.now().toString().slice(-4)}`;
    const contractPayload = {
      id: contractId,
      contract_number: `CN-${actualTenderId}`,
      title: 'عقد تنفيذ جدران استنادية وتوسعة وادي كفرنجة',
      contractor_name: tenderPayload.contractor,
      total_value: 175000,
      execution_period_days: 120,
      bank_name: 'البنك الإسلامي الأردني - فرع كفرنجة',
      guarantee_number: `BG-KAF-${Date.now().toString().slice(-4)}`,
      guarantee_value: 17500, // 10%
      guarantee_expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'ساري المفعول'
    };
    const createContract = await makeRequest('POST', '/api/contracts', contractPayload, token);
    assert(createContract.status === 200 || createContract.status === 201, 'Contract Execution & Bank Guarantee Registration', `Contract ID: ${contractPayload.id}`);

    // ج. إصدار أمر المباشرة وإسناد المهام الهندسية
    const taskPayload = {
      title: 'إشراف ومطابقة مناسيب الحفر للجدران الاستنادية',
      project_id: actualTenderId,
      assignedTo: 'م. أحمد الشويات',
      priority: 'عالية'
    };
    const createTask = await makeRequest('POST', '/api/tasks', taskPayload, token);
    assert(createTask.status === 200 || createTask.status === 201, 'Field Supervisory Task Assignment', `Task ID: ${createTask.data?.id}`);

    // د. تقديم مطالبة مالية جارية (دفعة مرحلية رقم 1)
    const claimPayload = {
      tenderId: actualTenderId,
      contractor: tenderPayload.contractor,
      claimNumber: 'CLM-01',
      amount: 45000,
      retentionPercent: 10,
      status: 'بانتظار تدقيق مهندس الموقع',
      notes: 'إنجاز أعمال الحفريات والصبة الخرسانية الأولى للجدار'
    };
    const createClaim = await makeRequest('POST', '/api/claims', claimPayload, token);
    const actualClaimId = createClaim.data?.id;
    assert((createClaim.status === 200 || createClaim.status === 201) && actualClaimId, 'Claim Submission with Financial Retention (10%)', `Claim ID: ${actualClaimId}`);

    // هـ. تمرير سلسلة الاعتماد الثلاثية (مهندس الإشراف ⬅️ رئيس القسم ⬅️ المدير الهندسي)
    const step1 = await makeRequest('POST', `/api/claims/${actualClaimId}/workflow`, {
      action: 'APPROVE_STEP',
      targetStatus: 'بانتظار تدقيق رئيس قسم المشاريع',
      notes: 'تمت مطابقة الكميات المنجزة ميدانياً وهي مطابقة للمواصفات'
    }, token);
    assert(step1.status === 200, 'Workflow Step 1: Site Engineer Inspection & Verification');

    const step2 = await makeRequest('POST', `/api/claims/${actualClaimId}/workflow`, {
      action: 'APPROVE_STEP',
      targetStatus: 'بانتظار اعتماد مدير الأشغال',
      notes: 'تم تدقيق جدول الكميات والأسعار الإفرادية واعتمادها'
    }, token);
    assert(step2.status === 200, 'Workflow Step 2: Projects Dept Head Financial Audit');

    const step3 = await makeRequest('POST', `/api/claims/${actualClaimId}/workflow`, {
      action: 'FINALIZE_APPROVAL',
      targetStatus: 'معتمدة وصالحة للصرف',
      notes: 'تم اعتماد الصرف النهائي للمطالبة بقرار المديرية'
    }, token);
    assert(step3.status === 200, 'Workflow Step 3: Engineering Directorate Final Sign-off');

    // و. إصدار أمر تغييري وفحص السقف القانوني (25%)
    const voPayload = {
      orderType: 'VALUE_INCREASE',
      amountChange: 15000, // أقل من 25% من 175000 (وهي 43,750)
      timeExtensionDays: 14,
      reason: 'إضافة جدار خرساني إضافي بطول 25م لحماية المنحدر الجبلي',
      approvedBy: 'مدير الأشغال الهندسية'
    };
    const createVO = await makeRequest('POST', `/api/contracts/${contractPayload.id}/variation-orders`, voPayload, token);
    assert(createVO.status === 200 || createVO.status === 201, 'Variation Order Issued within Legal 25% Threshold', `VO Value: ${voPayload.amountChange} JOD`);

    // =========================================================================
    // السيناريو الثاني: تصريح الحفر المتكامل وربطه بنظم الطرق (EPAMS ➡️ RAMS GIS)
    // =========================================================================
    console.log('\n🚧 4. بدء السيناريو الثاني: تصريح الحفر المتكامل والربط المكاني مع شبكة الطرق...');
    
    // أ. إنشاء تصريح حفر لشركة خدمية
    const permitPayload = {
      id: `PMT-2026-E2E-${Date.now().toString().slice(-4)}`,
      entity_name: 'شركة مياه اليرموك - مديرية مياه عجلون/كفرنجة',
      contact_person: 'م. سامر الصمادي',
      phone: '0780479507',
      location: 'شارع الحسبة الرئيسي - تقاطع المسجد الكبير',
      excavation_type: 'تمديد خط مياه رئيسي دكتايل 4 إنش',
      length_meters: 60,
      width_meters: 1.2,
      surface_type: 'asphalt',
      insurance_amount: 1800,
      fee_amount: 150,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'ACTIVE'
    };
    const createPermit = await makeRequest('POST', '/api/assets/permits', permitPayload, token);
    assert(createPermit.status === 200 || createPermit.status === 201, 'Excavation Permit Issued & Deposit Logged', `Permit ID: ${permitPayload.id}`);

    // ب. تنفيذ كشف إعادة الأوضاع وإخلاء طرف التأمين
    const reinstatePermit = await makeRequest('POST', `/api/assets/permits/${permitPayload.id}/reinstate`, {
      reinstatement_status: 'PASSED',
      asphalt_test_result: 'ناجح - مطابقة لسماكة 7سم ونسبة الدمك 98%',
      inspector_notes: 'تمت إعادة الأوضاع والدمك والتزفيت حسب المواصفات الفنية المعتمدة',
      refund_insurance: true
    }, token);
    assert(reinstatePermit.status === 200, 'Field Reinstatement Inspection & Insurance Refund Certification');

    // =========================================================================
    // التحقق الرقمي من المحررات الصادرة والبصمة الأمنية (SHA-256 Verification)
    // =========================================================================
    console.log('\n🔏 5. التحقق الرقمي ومطابقة البصمة الأمنية (SHA-256 Digital Seal Verification)...');
    const verifyDoc = await makeRequest('GET', `/api/v4/verify-document/${actualTenderId}`);
    const isDocValid = (verifyDoc.status === 200) && (verifyDoc.data?.isValid === true || verifyDoc.data?.success === true);
    const stampHash = verifyDoc.data?.data?.securityStamp?.hash || verifyDoc.data?.securityStamp?.hash || verifyDoc.data?.data?.verificationHash;
    assert(isDocValid, 'Public Document Cryptographic Authenticity Verified', `Digital Seal: ${String(stampHash).substring(0, 16)}...`);

    // إغلاق اتصال الـ WebSocket
    ws.close();

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log(`📊 النتيجة الإجمالية للمرحلة الثالثة (سيناريوهات التكامل الشامل E2E):`);
    console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
    console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
    console.log(`   🎯 نسبة نجاح دورة العمل الكاملة: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    return { passed, failed };
  } catch (err) {
    console.error('💥 E2E Integration Test Execution Error:', err);
    return { passed, failed: failed + 1 };
  }
}

if (require.main === module) {
  runE2EIntegrationTests().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runE2EIntegrationTests;

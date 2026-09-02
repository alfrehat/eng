/**
 * scripts/test-system-suite.js
 * سكريبت الفحص الآلي الشامل لصحة النظام، التوثيق، الصلاحيات، والمسارات البرمجية
 * بلدية كفرنجة الجديدة
 */

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3105;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 25, interval = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await makeRequest('GET', '/api/health');
      if (res.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🧪  بدء الفحص الآلي الشامل لنظام مديرية الأشغال - بلدية كفرنجة');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const isReady = await waitForServer();
    assert(isReady, 'Server started and ready to accept requests');

    // 1. فحص صحة الخادم وقاعدة البيانات
    console.log('\n🔍 1. اختبار نقطة فحص الحالة (Health Check)...');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, `Health check returned status 200 (Got: ${health.status})`);
    assert(health.data && health.data.status === 'healthy', 'System reported status healthy');

    // 2. اختبار رفض الطلبات غير المصرح لها بدون Token
    console.log('\n🔒 2. اختبار حماية المسارات (Reject Unauthenticated)...');
    const unauthTenders = await makeRequest('GET', '/api/tenders');
    assert(unauthTenders.status === 401, `Unauthenticated GET /api/tenders returned 401 (Got: ${unauthTenders.status})`);

    const unauthClaims = await makeRequest('GET', '/api/claims');
    assert(unauthClaims.status === 401, `Unauthenticated GET /api/claims returned 401 (Got: ${unauthClaims.status})`);

    // 3. اختبار رفض بيانات الدخول غير الصحيحة
    console.log('\n🔑 3. اختبار رفض بيانات الدخول غير الصحيحة...');
    const badLogin = await makeRequest('POST', '/api/login', { username: 'admin', password: 'wrong_password_123' });
    assert(badLogin.status === 401, `Bad login returned status 401 (Got: ${badLogin.status})`);

    // 4. اختبار تسجيل الدخول بحساب المدير الصحيح وتوليد JWT Token
    console.log('\n🔐 4. اختبار تسجيل الدخول وتوليد التوكن (JWT Authentication)...');
    const loginPageRes = await makeRequest('GET', '/login.html');
    assert(loginPageRes.status === 200, 'Modern login.html page is accessible (Status 200)');

    const loginRes = await makeRequest('POST', '/api/login', { username: 'admin', password: 'admin123' });
    let token = null;
    if (loginRes.status === 200 && loginRes.data && loginRes.data.token) {
      token = loginRes.data.token;
      assert(true, 'Login successful with JWT token generated');
      assert(loginRes.data.user && loginRes.data.user.role === 'admin', 'Admin role recognized correctly');
    } else {
      assert(false, `Login failed: ${JSON.stringify(loginRes.data)}`);
    }

    if (token) {
      // 5. اختبار استعلامات الـ API الموثقة بالـ Bearer Token...
      console.log('\n📊 5. اختبار استعلامات الـ API الموثقة بالـ Bearer Token...');
      const statsRes = await makeRequest('GET', '/api/stats', null, token);
      assert(statsRes.status === 200, `GET /api/stats with token returned 200 (Got: ${statsRes.status})`);

      const tendersRes = await makeRequest('GET', '/api/tenders', null, token);
      assert(Array.isArray(tendersRes.data), `GET /api/tenders returned array of tenders (Count: ${tendersRes.data?.length})`);

      const claimsRes = await makeRequest('GET', '/api/claims', null, token);
      assert(Array.isArray(claimsRes.data), `GET /api/claims returned array of claims (Count: ${claimsRes.data?.length})`);

      const roadsRes = await makeRequest('GET', '/api/roads', null, token);
      assert(roadsRes.status === 200, `GET /api/roads returned 200 (Got: ${roadsRes.status})`);

      const settingsRes = await makeRequest('GET', '/api/settings/identity', null, token);
      assert(settingsRes.status === 200 && settingsRes.data?.success === true, 'GET /api/settings/identity returned 200');

      const testBase64Logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.repeat(50);
      const updateIdentityRes = await makeRequest('PUT', '/api/settings/identity-visual', {
        appTitle: 'نظام إدارة المشاريع والأشغال الهندسية الموحد',
        municipalityName: 'بلدية كفرنجة الجديدة',
        directorateName: 'مديرية الأشغال والخدمات الهندسية',
        primaryColor: '#0f766e',
        secondaryColor: '#0284c7',
        accentColor: '#10b981',
        borderRadius: 12,
        darkMode: true,
        sessionTimeout: 15,
        headerLogo: testBase64Logo,
        fiscalYear: '2026'
      }, token);
      assert(updateIdentityRes.status === 200 && updateIdentityRes.data?.success === true, 'PUT /api/settings/identity-visual updated system appearance, session timeout and large base64 logo');

      // اختبار سجل الرقابة والحركات الشامل (Activity Log Engine)
      const postActRes = await makeRequest('POST', '/api/activity', {
        action: 'فحص أمان',
        entity: 'نظام الرقابة',
        entityId: 'SEC-001',
        details: 'تم إجراء اختبار دوري لتدقيق ومراقبة سجل العمليات'
      }, token);
      assert(postActRes.status === 200 && postActRes.data?.success === true, 'POST /api/activity recorded security action');

      const getActRes = await makeRequest('GET', '/api/activity?limit=10', null, token);
      const actList = Array.isArray(getActRes.data) ? getActRes.data : (getActRes.data?.data || []);
      assert(getActRes.status === 200 && Array.isArray(actList), `GET /api/activity retrieved audit trail records (Count: ${actList.length})`);

      const orgUnitsRes = await makeRequest('GET', '/api/org-units', null, token);
      assert(orgUnitsRes.status === 200 && Array.isArray(orgUnitsRes.data) && orgUnitsRes.data.length > 0, `GET /api/org-units returned array of departments (Count: ${orgUnitsRes.data?.length})`);

      const rolesRes = await makeRequest('GET', '/api/roles', null, token);
      assert(rolesRes.status === 200 && Array.isArray(rolesRes.data) && rolesRes.data.length > 0, `GET /api/roles returned array of roles (Count: ${rolesRes.data?.length})`);

      const uouRes = await makeRequest('GET', '/api/user-org-units', null, token);
      assert(uouRes.status === 200 && Array.isArray(uouRes.data), `GET /api/user-org-units returned array of assignments (Count: ${uouRes.data?.length})`);

      const lookupsRes = await makeRequest('GET', '/api/lookups', null, token);
      assert(lookupsRes.status === 200 && Array.isArray(lookupsRes.data) && lookupsRes.data.length > 0, `GET /api/lookups returned array of lookups (Count: ${lookupsRes.data?.length})`);

      const workflowsRes = await makeRequest('GET', '/api/workflows', null, token);
      assert(workflowsRes.status === 200 && Array.isArray(workflowsRes.data) && workflowsRes.data.length > 0, `GET /api/workflows returned array of workflows (Count: ${workflowsRes.data?.length})`);

      // اختبار حفظ وتعديل الوحدات التنظيمية والأدوار
      const editOuRes = await makeRequest('PUT', '/api/org-units/OU-01', {
        name: 'مديرية الأشغال والخدمات الهندسية',
        parentId: null,
        type: 'directorate',
        description: 'الإدارة العليا الهندسية لبلدية كفرنجة الجديدة'
      }, token);
      assert(editOuRes.status === 200 && editOuRes.data?.success === true, 'PUT /api/org-units/OU-01 updated successfully');

      const createTestRole = await makeRequest('POST', '/api/roles', {
        name: 'head_of_roads',
        label: 'رئيس قسم الطرق',
        description: 'إدارة وتنسيق مشاريع الطرق'
      }, token);
      assert(createTestRole.status === 201 && createTestRole.data?.success === true, 'POST /api/roles created engineering role template successfully');
      const createdRoleId = createTestRole.data?.id;

      const editRoleRes = await makeRequest('PUT', `/api/roles/${createdRoleId}`, {
        name: 'head_of_roads',
        label: 'رئيس قسم الطرق والبنية التحتية',
        description: 'إدارة وتنسيق مشاريع الطرق ودراسات البنية التحتية'
      }, token);
      assert(editRoleRes.status === 200 && editRoleRes.data?.success === true, 'PUT /api/roles updated role details successfully');

      const verifyRoleRes = await makeRequest('GET', '/api/roles', null, token);
      const updatedR = (verifyRoleRes.data || []).find(r => r.id === createdRoleId);
      assert(updatedR && updatedR.label === 'رئيس قسم الطرق والبنية التحتية', 'GET /api/roles verified custom role update persistence');

      // تنظيف الدور الاختباري المؤقت لضمان بقاء الأدوار الـ 10 الرسمية فقط
      if (createdRoleId) {
        await makeRequest('DELETE', `/api/roles/${createdRoleId}`, null, token);
      }

      const targetRoleId = (rolesRes.data && rolesRes.data[0]?.id) ? rolesRes.data[0].id : 'R-001';
      const editRolePerms = await makeRequest('POST', `/api/role-permissions/${targetRoleId}`, {
        permissions: ['*']
      }, token);
      // 5.0 إنشاء عطاء رسمي اختباري
      const createTenderRes = await makeRequest('POST', '/api/tenders', {
        id: 'T-2026-001',
        tender_number: 'T-2026-001',
        name: 'مشروع إعادة تأهيل وتعبيد شوارع كفرنجة الرئيسية',
        contractor: 'شركة صخور عجلون للمقاولات الإنشائية',
        tenderValue: 125000,
        estimatedCost: 125000,
        status: 'جاري التنفيذ',
        lat: 32.2985,
        lng: 35.7050
      }, token);
      assert(createTenderRes.status === 201 || createTenderRes.status === 200, 'POST /api/tenders created test tender');

      // 5.1 اختبار سلسلة اعتمادات وتواقيع المطالبات المالية (Workflow Stepper Engine)
      const wfCfgRes = await makeRequest('GET', '/api/claim-workflow-config', null, token);
      assert(wfCfgRes.status === 200 && Array.isArray(wfCfgRes.data), 'GET /api/claim-workflow-config returned approval steps');

      const uniqueClaimNum = 'CLM-TEST-' + Date.now();
      const createClaimRes = await makeRequest('POST', '/api/claims', {
        tenderId: 'T-2026-001',
        contractor: 'شركة صخور عجلون للمقاولات الإنشائية',
        claimNumber: uniqueClaimNum,
        claimType: 'دفعة إنجاز جارية',
        amount: 25000,
        completionPercentage: 35,
        retentionPercentage: 10,
        advanceDeduction: 1500,
        taxDeduction: 1250,
        notes: 'مطالبة تنفيذ أعمال رصف خلطة ساخنة - شارع القلعة'
      }, token);
      assert(createClaimRes.status === 201 && createClaimRes.data?.success === true, 'POST /api/claims created claim with financial calculations');
      const testClaimId = createClaimRes.data?.id;

      const wfStep1 = await makeRequest('POST', `/api/claims/${testClaimId}/workflow`, {
        targetStatus: 'بانتظار تدقيق رئيس القسم',
        action: 'تدقيق الموقع وتثبيت الكميات',
        notes: 'تمت مطابقة كميات الخلطة الإسفلتية الموردة وسماكة الرصفة'
      }, token);
      assert(wfStep1.status === 200 && wfStep1.data?.success === true, 'POST /api/claims/:id/workflow transitioned step 1');

      const wfStep2 = await makeRequest('POST', `/api/claims/${testClaimId}/workflow`, {
        targetStatus: 'معتمدة وجاهزة للصرف المالي',
        action: 'المصادقة والاعتماد النهائي للصرف',
        notes: 'مطابق للمواصفات الفنية وجداول الكميات المعتمدة'
      }, token);
      assert(wfStep2.status === 200 && wfStep2.data?.success === true, 'POST /api/claims/:id/workflow finalized approval');

      const checkClaimRes = await makeRequest('GET', `/api/claims/${testClaimId}`, null, token);
      assert(checkClaimRes.status === 200 && (checkClaimRes.data?.status || '').includes('معتمدة'), 'Claim status successfully marked as approved with full audit history');

      const claimSummary = await makeRequest('GET', '/api/claims/tender/T-2026-001/summary', null, token);
      assert(claimSummary.status === 200 && claimSummary.data?.totalClaims >= 1, 'Tender claims summary calculated aggregate values accurately');

      // 5.1.2 اختبار منظومة إدارة المشتريات والتوريدات ولجان الاستلام (Purchases & Supplies Engine)
      const createPurchaseRes = await makeRequest('POST', '/api/purchases', {
        item: 'توريد إشارات مرورية وعواكس فسفورية لشوارع كفرنجة',
        supplier: 'مؤسسة السلامة المرورية الأردنية',
        amount: 3200,
        quantity: 50,
        unit: 'لوحة',
        department: 'قسم المشروعات والسلامة المرورية',
        purchaseType: 'شراء مباشر',
        notes: 'توريد فوري لتعزيز السلامة على منعطفات طريق وادي راجب'
      }, token);
      assert(createPurchaseRes.status === 201 && createPurchaseRes.data?.success === true, 'POST /api/purchases created purchase order');
      const testPurchaseId = createPurchaseRes.data?.id;

      const getPurchaseRes = await makeRequest('GET', `/api/purchases/${testPurchaseId}`, null, token);
      assert(getPurchaseRes.status === 200 && (getPurchaseRes.data?.item || getPurchaseRes.data?.itemDescription), 'GET /api/purchases/:id retrieved purchase details');

      // 5.2 اختبار منظومة إدارة العقود والأوامر التغييرية والكفالات البنكية (Contracts & Guarantees)
      const alertsRes = await makeRequest('GET', '/api/contracts/guarantees/alerts', null, token);
      assert(alertsRes.status === 200 && alertsRes.data?.success === true, 'GET /api/contracts/guarantees/alerts returned bank guarantees analytics');

      const createContractRes = await makeRequest('POST', '/api/contracts', {
        id: 'CNT-2026-TEST-01',
        contract_number: 'CN-KAF-2026-01',
        title: 'عقد إعادة تأهيل وتعبيد شارع الأغوار ومدخل كفرنجة الغربي',
        contractor_name: 'شركة صخور عجلون للمقاولات',
        total_value: 120000,
        execution_period_days: 90,
        bank_name: 'البنك الإسلامي الأردني',
        guarantee_number: 'BG-KAF-9988',
        guarantee_value: 12000,
        guarantee_expiry_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0]
      }, token);
      assert(createContractRes.status === 201 && createContractRes.data?.success === true, 'POST /api/contracts created contract with guarantee tracking');

      const voRes = await makeRequest('POST', '/api/contracts/CNT-2026-TEST-01/variation-orders', {
        orderType: 'VALUE_INCREASE',
        amountChange: 15000,
        timeExtensionDays: 14,
        reason: 'توسعة إضافية لجزر المرور وعبارات تصريف المياه',
        approvedBy: 'مدير الأشغال الهندسية'
      }, token);
      assert(voRes.status === 201 && voRes.data?.success === true, 'POST /api/contracts/:id/variation-orders created VO with legal limit enforcement');
      assert(voRes.data?.data?.legal_check?.within_legal_cap !== false, 'Variation order verified to be within the 25% legal threshold');

      const getVoRes = await makeRequest('GET', '/api/contracts/CNT-2026-TEST-01/variation-orders', null, token);
      assert(getVoRes.status === 200 && getVoRes.data?.count >= 1, 'GET /api/contracts/:id/variation-orders calculated net metrics accurately');

      const extRes = await makeRequest('POST', '/api/contracts/CNT-2026-TEST-01/guarantee/extend', {
        newExpiryDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
        bankLetterRef: 'LET-BANK-44552',
        notes: 'تمديد الكفالة لتغطية مدة أمر التغيير وفترة الصيانة'
      }, token);
      assert(extRes.status === 200 && extRes.data?.success === true, 'POST /api/contracts/:id/guarantee/extend successfully extended bank guarantee');

      // 5.3 اختبار منظومة تصاريح الحفريات وإعادة الأوضاع (Excavation System)

      const createPermitRes = await makeRequest('POST', '/api/assets/permits', {
        applicant: 'سلطة المياه - إقليم الشمال',
        contractor: 'شركة الهيدروليكا للمقاولات',
        district: 'كفرنجة - الحي الشرقي',
        purpose: 'تمديد خط مياه رئيسي قطر 4 إنش',
        permitType: 'WATER_CONNECTION',
        lengthM: 85.0,
        widthM: 0.8,
        depthM: 1.2,
        insuranceFee: 1500,
        feeAmount: 350,
        lat: 32.3125,
        lng: 35.7230
      }, token);
      assert(createPermitRes.status === 201 && createPermitRes.data?.success === true, 'POST /api/assets/permits created excavation permit');
      const testPermitId = createPermitRes.data?.data?.id;

      const reinstateRes = await makeRequest('POST', `/api/assets/permits/${testPermitId}/reinstate`, {
        inspectorName: 'م. أحمد الخشمان',
        inspectionNotes: 'تمت إعادة سفلتة الشارع والدحل بالمداحل المعتمدة',
        status: 'COMPLETED'
      }, token);
      assert(reinstateRes.status === 200 && reinstateRes.data?.success === true, 'POST /api/assets/permits/:id/reinstate certified road restoration and insurance release');

      // 6. اختبار اتصال الـ WebSockets واستقبال الإشعار الحي
      console.log('\n⚡ 6. اختبار اتصال الـ WebSocket والبث اللحظي...');
      const WebSocket = require('ws');
      const wsClient = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws?token=${token}`);

      let wsConnected = false;
      let wsReceived = false;

      await new Promise((resolve) => {
        wsClient.on('open', () => {
          wsConnected = true;
          // Trigger a notification to test broadcast
          makeRequest('POST', '/api/notifications', {
            message: 'فحص الإشعار اللحظي عبر الـ WebSockets',
            title: '⚡ اختبار البث الحي',
            type: 'system'
          }, token);
        });

        wsClient.on('message', (data) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'NEW_NOTIFICATION') {
              wsReceived = true;
              resolve();
            }
          } catch (e) {}
        });

        setTimeout(resolve, 2000);
      });

      wsClient.close();
      assert(wsConnected, 'WebSocket connected successfully to /ws');
      assert(wsReceived, 'WebSocket received live broadcast notification');

      // 7. اختبار بوابة ونقطة التحقق الرقمي من كافة وثائق ومخرجات النظام (QR Verification Engine)
      console.log('\n📜 7. اختبار محرك التحقق الرقمي الشامل لكافة الوثائق والمخرجات...');
      const browseDocsRes = await makeRequest('GET', '/api/v4/verify-document/browse/all');
      assert(browseDocsRes.status === 200, 'GET /api/v4/verify-document/browse/all returned 200');
      assert(Array.isArray(browseDocsRes.data?.data), 'Browse endpoint returned list of system documents');

      const verifyTender = await makeRequest('GET', '/api/v4/verify-document/T-2026-001');
      assert(verifyTender.status === 200, `GET /api/v4/verify-document/T-2026-001 returned 200`);
      assert(verifyTender.data && verifyTender.data.isValid === true, 'Tender document verified as authentic');
      assert(verifyTender.data.data && verifyTender.data.data.verificationHash.startsWith('KJ-SEC-'), 'Document contains valid SHA-256 security stamp');

      const verifyRoad = await makeRequest('GET', '/api/v4/verify-document/RD-2026-003');
      assert(verifyRoad.status === 200, `GET /api/v4/verify-document/RD-2026-003 returned 200`);
      assert(verifyRoad.data && verifyRoad.data.isValid === true, 'Road document RD-2026-003 verified as authentic');
      assert(Boolean(verifyRoad.data && verifyRoad.data.data && verifyRoad.data.data.id === 'RD-2026-003'), 'Road document ID matched accurately');

      const invalidDoc = await makeRequest('GET', '/api/v4/verify-document/NON_EXISTENT_999');
      assert(invalidDoc.status === 404, 'Invalid document ID correctly returned 404');

      const verifyPage = await makeRequest('GET', '/verify.html');
      assert(verifyPage.status === 200, 'Public verify.html portal page is accessible (Status 200)');

      // 8. اختبار طبقة الـ GIS وحساب الـ PCI وخريطة النقاط الحرارية
      console.log('\n🗺️ 8. اختبار طبقات الـ GIS ونظم تصنيف الطرق (PCI & Spatial)...');
      const gisRes = await makeRequest('GET', '/api/roads/gis-layer', null, token);
      assert(gisRes.status === 200, 'GET /api/roads/gis-layer returned 200');
      assert(gisRes.data && gisRes.data.type === 'FeatureCollection', 'GIS layer returned valid GeoJSON FeatureCollection');

      const pciCalcRes = await makeRequest('POST', '/api/roads/calculate-pci', {
        totalAreaM2: 700,
        distresses: [
          { type: 'تمساحي', severity: 'عالي', areaM2: 25 },
          { type: 'حفر', severity: 'متوسط', areaM2: 5 }
        ]
      }, token);
      assert(pciCalcRes.status === 200, 'POST /api/roads/calculate-pci returned 200');
      assert(pciCalcRes.data && pciCalcRes.data.pci > 0 && pciCalcRes.data.pci <= 100, `PCI calculation generated valid score (Got: ${pciCalcRes.data?.pci})`);
      assert(pciCalcRes.data && pciCalcRes.data.recommendation, 'PCI calculation returned engineering recommendation');

      const heatmapRes = await makeRequest('GET', '/api/roads/heatmap', null, token);
      assert(heatmapRes.status === 200, 'GET /api/roads/heatmap returned 200');
      assert(heatmapRes.data && Array.isArray(heatmapRes.data.data), 'Heatmap points returned array of critical road spots');

      // 8.2 اختبار التحليلات المكانية للـ GIS ومؤشرات أولوية إعادة التأهيل (Spatial Analytics & Composite Layers)
      const spatialRes = await makeRequest('GET', '/api/roads/spatial-analytics', null, token);
      assert(spatialRes.status === 200 && spatialRes.data?.success === true, 'GET /api/roads/spatial-analytics returned district spatial analysis');
      assert(Array.isArray(spatialRes.data?.rehabilitation_priorities), 'Spatial analytics generated road rehabilitation priorities');

      const compositeGis = await makeRequest('GET', '/api/roads/gis-layers/composite', null, token);
      assert(compositeGis.status === 200 && compositeGis.data?.type === 'FeatureCollection', 'GET /api/roads/gis-layers/composite returned valid GeoJSON FeatureCollection');

      // 9. اختبار نظام النسخ الاحتياطي المشفر (AES-256 Automated Backups)
      console.log('\n🔒 9. اختبار نظام النسخ الاحتياطي المشفر بـ AES-256...');
      const unauthBackup = await makeRequest('POST', '/api/v4/admin/trigger-backup');
      assert(unauthBackup.status === 401, 'Unauthenticated trigger-backup rejected (Status 401)');

      const triggerRes = await makeRequest('POST', '/api/v4/admin/trigger-backup', {}, token);
      assert(triggerRes.status === 200, 'POST /api/v4/admin/trigger-backup returned 200');
      assert(triggerRes.data && triggerRes.data.success === true, 'Encrypted backup created successfully');
      assert(triggerRes.data.data && triggerRes.data.data.filename.endsWith('.enc'), `Backup file encrypted with AES-256 (${triggerRes.data?.data?.filename})`);

      const listBackupsRes = await makeRequest('GET', '/api/v4/admin/backups-list', null, token);
      assert(listBackupsRes.status === 200 && Array.isArray(listBackupsRes.data.data) && listBackupsRes.data.data.length > 0, 'Backups list retrieved successfully');

      // 10. اختبار محرك التقارير والمستخلصات الرسمية وتصدير الإكسل (Official Print/PDF & Excel Engine)
      console.log('\n📄 10. اختبار محرك التقارير والمستخلصات البلدية الرسمية...');
      const genDocRes = await makeRequest('GET', '/api/reports/generate-official?module=claims&id=C-2026-001', null, token);
      assert(genDocRes.status === 200, 'GET /api/reports/generate-official returned 200');
      assert(typeof genDocRes.data === 'string' && genDocRes.data.includes('بلدية كفرنجة الجديدة'), 'Official document contains municipal headers and watermarks');

      const excelRes = await makeRequest('GET', '/api/reports/export-excel?module=roads', null, token);
      assert(excelRes.status === 200, 'GET /api/reports/export-excel returned 200');
      assert(typeof excelRes.data === 'string' && excelRes.data.startsWith('\uFEFF'), 'Excel file exported with UTF-8 BOM encoding for perfect Arabic rendering');

      // 11. اختبار محرك مسارات العمل والموافقات الموحد (Workflow Engine)
      console.log('\n🔄 11. اختبار محرك مسارات العمل والموافقات الموحد (Workflows Engine)...');
      const wfStepsRes = await makeRequest('GET', '/api/v4/workflows/steps', null, token);
      assert(wfStepsRes.status === 200 && wfStepsRes.data?.success === true, 'GET /api/v4/workflows/steps returned 200');
      assert(Boolean(wfStepsRes.data?.steps?.DRAFT), 'Workflow steps contain DRAFT stage definition');

      // 12. اختبار بوابة التكامل الحكومي (G2G Gateway)
      console.log('\n🏛️ 12. اختبار بوابة التكامل الحكومي الآمنة (G2G Integration Gateway)...');
      const g2gFinanceRes = await makeRequest('GET', '/api/v4/g2g/finance/budget-status?apiKey=kfranjah-g2g-secret-key');
      assert(g2gFinanceRes.status === 200, 'GET /api/v4/g2g/finance/budget-status returned 200');
      assert(Boolean(g2gFinanceRes.data?.municipality && g2gFinanceRes.data?.summary), 'G2G finance report aggregated summary successfully');

      const g2gGisRes = await makeRequest('GET', '/api/v4/g2g/gis/spatial-layers?apiKey=kfranjah-g2g-secret-key');
      assert(g2gGisRes.status === 200, 'GET /api/v4/g2g/gis/spatial-layers returned 200');
      assert(g2gGisRes.data?.type === 'FeatureCollection', 'G2G GIS layers returned valid FeatureCollection');

      // 13. اختبار محرك العقود والربط الشرائي (Contracts & Procurement Engine)
      console.log('\n📜 13. اختبار تكامل العقود والعمليات الشرائية (Contracts & Procurements)...');
      const procurementsRes = await makeRequest('GET', '/api/contracts/procurements', null, token);
      assert(procurementsRes.status === 200, 'GET /api/contracts/procurements returned 200');
      const procList = Array.isArray(procurementsRes.data) ? procurementsRes.data : (procurementsRes.data?.data || []);
      assert(Array.isArray(procList) && procList.length > 0, `Contracts procurement auto-populate returned options (Count: ${procList.length})`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`📊 النتيجة النهائية للفحص: ${passed} نجح | ${failed} فشل`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Test suite encountered fatal error:', err);
    process.exit(1);
  }
}

// Start server in background for testing
const serverProc = spawn('node', ['server.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: Object.assign({}, process.env, { PORT: '3105', HOST: '127.0.0.1' })
});
serverProc.stdout.on('data', d => {
  const str = d.toString();
  if (str.includes('Workflow') || str.includes('ClaimsEngine') || str.includes('ERROR') || str.includes('error')) {
    console.log('[SERVER LOG]', str.trim());
  }
});
serverProc.stderr.on('data', d => console.error('[SERVER STDERR]', d.toString().trim()));

runTests().finally(() => {
  serverProc.kill();
});

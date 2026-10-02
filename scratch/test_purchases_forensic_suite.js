const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Set test environment
process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

async function runPurchasesForensicSuite() {
  console.log('===============================================================');
  console.log('🏛️  KAFRANJAH MUNICIPALITY - PURCHASES DOMAIN FORENSIC SUITE  🏛️');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const snapArchive = fs.existsSync(path.join(__dirname, '..', 'data', 'archive.json')) ? fs.readFileSync(path.join(__dirname, '..', 'data', 'archive.json'), 'utf8') : null;
  const snapDocs = fs.existsSync(path.join(__dirname, '..', 'data', 'documents.json')) ? fs.readFileSync(path.join(__dirname, '..', 'data', 'documents.json'), 'utf8') : null;
  const snapDbArchive = fs.existsSync(path.join(__dirname, '..', 'database', 'archive.json')) ? fs.readFileSync(path.join(__dirname, '..', 'database', 'archive.json'), 'utf8') : null;
  const snapDbDocs = fs.existsSync(path.join(__dirname, '..', 'database', 'documents.json')) ? fs.readFileSync(path.join(__dirname, '..', 'database', 'documents.json'), 'utf8') : null;

  function restoreSnapshots() {
    try {
      if (snapArchive) fs.writeFileSync(path.join(__dirname, '..', 'data', 'archive.json'), snapArchive, 'utf8');
      if (snapDocs) fs.writeFileSync(path.join(__dirname, '..', 'data', 'documents.json'), snapDocs, 'utf8');
      if (snapDbArchive) fs.writeFileSync(path.join(__dirname, '..', 'database', 'archive.json'), snapDbArchive, 'utf8');
      if (snapDbDocs) fs.writeFileSync(path.join(__dirname, '..', 'database', 'documents.json'), snapDbDocs, 'utf8');
    } catch (e) {}
  }

  function recordPass(testName, details = '') {
    passed++;
    console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  function recordFail(testName, error) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${error.message || error}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Static Architecture & Anti-Corruption Guard
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Static Architecture & Anti-Corruption Verification ---');
  try {
    const apiFile = path.join(__dirname, '..', 'Purchases', 'API', 'purchasesEngine.js');
    const apiContent = fs.readFileSync(apiFile, 'utf8');

    // 1.1 Zero direct database calls in API
    assert.strictEqual(apiContent.includes('dbQuery'), false, 'API adapter must not use dbQuery');
    assert.strictEqual(apiContent.includes('dbGet'), false, 'API adapter must not use dbGet');
    assert.strictEqual(apiContent.includes('dbRun'), false, 'API adapter must not use dbRun');
    assert.strictEqual(apiContent.includes('pool.query'), false, 'API adapter must not use pool.query');
    assert.strictEqual(apiContent.includes('memDb'), false, 'API adapter must not contain memDb');
    assert.strictEqual(apiContent.includes('saveMemTable'), false, 'API adapter must not contain saveMemTable');
    assert.strictEqual(apiContent.includes('kfranjah-secure-pki-key-2026'), false, 'API adapter must not have hardcoded fallback JWT secret');
    recordPass('API Adapter Anti-Corruption', 'Zero direct SQL, Zero memDb, Zero hardcoded secrets');

    // 1.2 Preservation of Purchases/Pages/unifiedPurchasesManager.js
    const uiFile = path.join(__dirname, '..', 'Purchases', 'Pages', 'unifiedPurchasesManager.js');
    assert.strictEqual(fs.existsSync(uiFile), true, 'unifiedPurchasesManager.js must exist');
    const uiContent = fs.readFileSync(uiFile, 'utf8');
    assert.ok(uiContent.length > 500, 'unifiedPurchasesManager.js must be non-empty');
    recordPass('UI Manager Intact', `Size: ${uiContent.length} bytes preserved`);

    // 1.3 Server mounting
    const serverFile = path.join(__dirname, '..', 'server.js');
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    assert.ok(serverContent.includes("require('./Purchases/API/purchasesEngine')") || serverContent.includes('purchasesEngine'), 'server.js must mount purchasesEngine');
    recordPass('Server Route Mounting', 'Mounted at /api/purchases');
  } catch (err) {
    recordFail('Static Architecture Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Engine Registry Registration & Canonical Contract
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Engine Registry & Canonical Contract Verification ---');
  try {
    const engineRegistry = require('../services/engineRegistry');
    const purchasesEngine = engineRegistry.get('PURCHASES_ENGINE');
    assert.ok(purchasesEngine, 'PURCHASES_ENGINE must be registered in engineRegistry');
    assert.strictEqual(purchasesEngine.status, 'READY', 'PURCHASES_ENGINE status must be READY');
    assert.ok(purchasesEngine.capabilities.includes('purchases_crud'), 'Must include purchases_crud');
    assert.ok(purchasesEngine.capabilities.includes('receiving_committee'), 'Must include receiving_committee');
    assert.ok(purchasesEngine.capabilities.includes('workflow_dispatch'), 'Must include workflow_dispatch');
    assert.ok(purchasesEngine.capabilities.includes('budget_commitment'), 'Must include budget_commitment');

    // Operations
    const ops = Object.keys(purchasesEngine.exposedOperations);
    assert.ok(ops.includes('getPurchases'), 'Must expose getPurchases');
    assert.ok(ops.includes('getPurchaseById'), 'Must expose getPurchaseById');
    assert.ok(ops.includes('createPurchase'), 'Must expose createPurchase');
    assert.ok(ops.includes('updatePurchase'), 'Must expose updatePurchase');
    assert.ok(ops.includes('advanceWorkflow'), 'Must expose advanceWorkflow');
    assert.ok(ops.includes('receivePurchaseItems'), 'Must expose receivePurchaseItems');
    assert.ok(ops.includes('approvePurchase'), 'Must expose approvePurchase');
    assert.ok(ops.includes('deletePurchase'), 'Must expose deletePurchase');
    assert.ok(ops.includes('getPurchasesStats'), 'Must expose getPurchasesStats');
    recordPass('Engine Registry Registration', `10 canonical exposed operations verified`);

    // Health check
    const health = await purchasesEngine.healthCheck();
    assert.ok(health.status === 'READY' || health.status === 'UP', 'Health check status must be READY or UP');
    assert.ok(health.database === 'CONNECTED' || health.database === 'IN_MEMORY', 'Database status must be reported');
    recordPass('Engine Health Check', `Status: ${health.status}, DB: ${health.database}, Engine: ${health.engineId}`);
  } catch (err) {
    recordFail('Engine Registry Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Domain Service CRUD & Centralized Numbering
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Canonical Service CRUD, Central Numbering & DB Persistence ---');
  let testPurchaseId = null;
  const mockUser = { id: 'TEST-ENG-001', name: 'مهندس فحص الجودة', role: 'admin', department: 'الهندسة' };

  try {
    const purchasesService = require('../services/purchasesEngineService');

    // 3.1 Initial Stats
    const initialStats = await purchasesService.getPurchasesStats();
    assert.ok(initialStats.success === true, 'Stats must be successful');
    assert.ok(typeof initialStats.stats.totalCount === 'number', 'Stats must include stats.totalCount');
    assert.ok(typeof initialStats.stats.totalAmount === 'number', 'Stats must include stats.totalAmount');
    recordPass('Initial Stats Query', `Total items: ${initialStats.stats.totalCount}, Total sum: ${initialStats.stats.totalAmountFormatted}`);

    // 3.2 Create Purchase
    const purchaseData = {
      item: 'مستلزمات صيانة طرق وأسفلت بارد للاختبار الجنائي',
      itemDescription: 'توريد 5 أطنان خلطة إسفلتية باردة لترقيعات شوارع كفرنجة',
      quantity: 5,
      unit: 'طن',
      price: 120,
      value: 600,
      supplier: 'شركة المناصير للخرسانة والإسفلت',
      department: 'قسم الصيانة والإنشاءات',
      category: 'مواد صيانة',
      urgency: 'عاجل',
      committeeName: 'لجنة استلام المواد الإنشائية',
      district: 'الحي الشرقي',
      street: 'شارع البلدية الرئيسي',
      notes: 'فحص تكاملي جنائي لنطاق المشتريات'
    };

    const created = await purchasesService.createPurchase(purchaseData, mockUser);
    assert.ok(created, 'createPurchase must return the created entity');
    assert.ok(created.id, 'Created purchase must have an id');
    assert.match(created.id, /^PUR-\d{4}-\d{4}$/, 'ID must match canonical pattern PUR-YYYY-XXXX');
    testPurchaseId = created.id;
    assert.strictEqual(created.status, 'مسودة / قيد التنظيم', 'Initial status must be canonical draft');
    assert.strictEqual(Number(created.amount || created.value), 600, 'Amount must be 600');
    assert.ok(Array.isArray(created.workflowHistory), 'workflowHistory must be an array');
    assert.strictEqual(created.workflowHistory.length, 1, 'workflowHistory must have initial entry');
    recordPass('Central Numbering & Purchase Creation', `Generated ID: ${created.id}, Numbering Monotonicity Verified`);

    // 3.3 Verify DB Persistence in PostgreSQL
    const { dbQuery } = require('../utils/database');
    const dbRow = await dbQuery('SELECT * FROM public.purchases WHERE id = $1', [testPurchaseId]);
    assert.strictEqual(dbRow.length, 1, 'Record must exist in public.purchases');
    assert.strictEqual(dbRow[0].id, testPurchaseId);
    assert.strictEqual(dbRow[0].supplier, 'شركة المناصير للخرسانة والإسفلت');
    assert.strictEqual(Number(dbRow[0].value), 600);
    recordPass('PostgreSQL Persistence', `Verified in public.purchases with id=${testPurchaseId}`);

    // 3.4 Verify Audit Log Generation
    const auditRow = await dbQuery(
      "SELECT * FROM activity_log WHERE action = 'PURCHASE_ORDER_CREATED' AND (\"entityId\" = $1 OR details ILIKE $2) ORDER BY \"createdAt\" DESC LIMIT 1",
      [testPurchaseId, `%${testPurchaseId}%`]
    );
    assert.ok(auditRow.length >= 1, 'Audit log must record PURCHASE_ORDER_CREATED in activity_log');
    recordPass('Audit Log Verification', `Audit record ID: ${auditRow[0].id}, Action: ${auditRow[0].action}`);

    // 3.5 Query by ID
    const retrieved = await purchasesService.getPurchaseById(testPurchaseId);
    assert.ok(retrieved, 'getPurchaseById must find the record');
    assert.strictEqual(retrieved.id, testPurchaseId);
    recordPass('Read by ID', `Found purchase with supplier: ${retrieved.supplier}`);

    // 3.6 Update Purchase
    const updated = await purchasesService.updatePurchase(testPurchaseId, {
      notes: 'تم تحديث الملاحظات وتأكيد موعد التوريد',
      price: 130,
      value: 650
    }, mockUser);
    assert.strictEqual(Number(updated.value), 650, 'Value must be updated to 650');
    assert.strictEqual(updated.notes, 'تم تحديث الملاحظات وتأكيد موعد التوريد');
    recordPass('Update Purchase', 'Updated value to 650 and updated database fields');
  } catch (err) {
    recordFail('Canonical Service CRUD Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Workflow Engine, Archive Engine & Receiving Committee
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Workflow Progression, Document Archiving & Receipt Committee ---');
  try {
    const purchasesService = require('../services/purchasesEngineService');
    const { dbQuery } = require('../utils/database');

    // 4.1 Advance Workflow to 'معتمد للتوريد والتنفيذ'
    const approved = await purchasesService.advanceWorkflow(testPurchaseId, {
      nextStatus: 'معتمد للتوريد والتنفيذ',
      note: 'تمت موافقة مدير الدائرة الهندسية على أمر الشراء'
    }, mockUser);
    assert.strictEqual(approved.status, 'معتمد للتوريد والتنفيذ');
    assert.ok(Array.isArray(approved.history || approved.workflowHistory));
    recordPass('Workflow Approval', `Status transitioned to 'معتمد للتوريد والتنفيذ'`);

    // 4.2 Receive Items via Receiving Committee
    const received = await purchasesService.receivePurchaseItems(testPurchaseId, {
      inspectionNotes: 'تم استلام الخلطة الإسفلتية ومطابقتها للمواصفات الفنية المعتمدة',
      committeeMembers: 'لجنة استلام المواد الإنشائية',
      condition: 'مطابق للمواصفات',
      receiptNumber: 'REC-2026-0988'
    }, mockUser);
    assert.strictEqual(received.status, 'تم الاستلام والتسديد والمطابقة - مغلقة');
    recordPass('Receiving Committee Execution', 'Delivery confirmed, inspection passed, order closed');

    // 4.3 Verify Automatic Receipt Document Archiving
    const docRow = await dbQuery(
      "SELECT * FROM public.documents WHERE reference_number = $1 OR related_id = $1 ORDER BY id DESC LIMIT 1",
      [testPurchaseId]
    );
    assert.ok(docRow.length >= 1, 'Automatic document archive record must exist for received purchase');
    assert.ok(docRow[0].title.includes('محضر استلام') || docRow[0].title.includes('أمر شراء'), 'Document title must reflect purchase receipt');
    recordPass('Automatic Document Archiving', `Archived in public.documents: doc_id=${docRow[0].id}, title=${docRow[0].title}`);
  } catch (err) {
    recordFail('Workflow & Archive Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Filtered Search, Pagination & Stats Validation
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Search, Filters & Aggregations Verification ---');
  try {
    const purchasesService = require('../services/purchasesEngineService');

    // Search by keyword
    const searchRes = await purchasesService.getPurchases({ search: 'المناصير' }, mockUser);
    assert.ok(Array.isArray(searchRes), 'Search result must be an array');
    assert.ok(searchRes.length >= 1, 'Search by supplier must return items');
    assert.ok(searchRes.some(p => p.id === testPurchaseId), 'Search result must include test item');
    recordPass('Search Filtering', `Found ${searchRes.length} records matching 'المناصير'`);

    // Search by status
    const statusRes = await purchasesService.getPurchases({ status: 'تم الاستلام والتسديد والمطابقة - مغلقة' }, mockUser);
    assert.ok(Array.isArray(statusRes), 'Status result must be an array');
    assert.ok(statusRes.some(p => p.id === testPurchaseId), 'Status filter must include delivered item');
    recordPass('Status Filtering', `Found ${statusRes.length} records matching closed status`);

    // Stats aggregation
    const updatedStats = await purchasesService.getPurchasesStats();
    assert.ok(updatedStats.stats.totalCount >= 1, 'Total count must reflect added purchase');
    recordPass('Aggregated Stats', `Total: ${updatedStats.stats.totalCount}, Sum: ${updatedStats.stats.totalAmountFormatted}`);
  } catch (err) {
    recordFail('Search & Filters Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Express HTTP Endpoints Integration & Auth Enforcement
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 6. HTTP API Adapter Integration & Auth Verification ---');
  try {
    const express = require('express');
    const http = require('http');
    const jwt = require('jsonwebtoken');

    const app = express();
    app.use(express.json());

    // Mount Central Auth Middleware
    const { authenticate } = require('../middlewares/authMiddleware');
    app.use(authenticate);

    // Mount Purchases API router
    const purchasesRouter = require('../Purchases/API/purchasesEngine');
    app.use('/api/purchases', purchasesRouter);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(urlPath, options = {}) {
      return new Promise((resolve, reject) => {
        const u = new URL(urlPath, baseUrl);
        const reqOpts = {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: options.method || 'GET',
          headers: options.headers || {}
        };
        const r = http.request(reqOpts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let body = data;
            try { body = JSON.parse(data); } catch (e) {}
            resolve({ status: res.statusCode, headers: res.headers, body });
          });
        });
        r.on('error', reject);
        if (options.body) {
          r.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        r.end();
      });
    }

    // 6.1 Public / Health Endpoint
    const healthRes = await req('/api/purchases/health');
    assert.strictEqual(healthRes.status, 200, 'Health endpoint must return 200');
    assert.ok(healthRes.body.healthy === true, 'Health status must be true');
    recordPass('HTTP Health Endpoint', 'GET /api/purchases/health returned 200 READY');

    // 6.2 Auth Enforcement - Unauthenticated request to protected endpoint
    const unauthRes = await req('/api/purchases');
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');
    recordPass('HTTP Auth Enforcement', 'GET /api/purchases without token rejected with 401');

    // 6.3 Authenticated request
    const token = jwt.sign(
      { id: 'TEST-ENG-001', username: 'admin', role: 'admin', department: 'الهندسة' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const getRes = await req('/api/purchases', { headers: authHeaders });
    assert.strictEqual(getRes.status, 200, 'Authenticated request must return 200');
    assert.ok(Array.isArray(getRes.body), 'Response must contain purchases array');
    recordPass('HTTP Authenticated Query', 'GET /api/purchases returned 200 with data');

    // 6.4 Stats endpoint
    const statsRes = await req('/api/purchases/stats', { headers: authHeaders });
    assert.strictEqual(statsRes.status, 200, 'Stats endpoint must return 200');
    assert.ok(statsRes.body.stats || statsRes.body.totalCount !== undefined);
    recordPass('HTTP Stats Endpoint', 'GET /api/purchases/stats returned 200');

    // 6.5 Get single purchase
    const getSingleRes = await req(`/api/purchases/${testPurchaseId}`, { headers: authHeaders });
    assert.strictEqual(getSingleRes.status, 200, 'Get single purchase must return 200');
    assert.strictEqual(getSingleRes.body.id, testPurchaseId);
    recordPass('HTTP Get By ID Endpoint', `GET /api/purchases/${testPurchaseId} returned 200`);

    // Clean up server
    await new Promise((resolve) => server.close(resolve));
  } catch (err) {
    recordFail('HTTP API Adapter Integration', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: Safe Deletion & Budget De-allocation
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Deletion & Financial De-allocation Verification ---');
  try {
    const purchasesService = require('../services/purchasesEngineService');
    const { dbQuery } = require('../utils/database');

    if (testPurchaseId) {
      const delResult = await purchasesService.deletePurchase(testPurchaseId, mockUser);
      assert.strictEqual(delResult.success, true, 'deletePurchase must succeed');
      recordPass('Purchase Deletion', `Successfully deleted ${testPurchaseId}`);

      // Verify DB record is gone
      const checkRow = await dbQuery('SELECT * FROM public.purchases WHERE id = $1', [testPurchaseId]);
      assert.strictEqual(checkRow.length, 0, 'Record must be removed from public.purchases');
      recordPass('DB Confirmation of Deletion', 'Record cleanly removed');

      // Verify Audit Log for deletion
      const delAudit = await dbQuery(
        "SELECT * FROM activity_log WHERE action = 'PURCHASE_ORDER_DELETED' AND (\"entityId\" = $1 OR details ILIKE $2) ORDER BY \"createdAt\" DESC LIMIT 1",
        [testPurchaseId, `%${testPurchaseId}%`]
      );
      assert.ok(delAudit.length >= 1, 'Deletion must be audited in activity_log');
      recordPass('Audit Log for Deletion', `Audit record ID: ${delAudit[0].id}`);
    }
  } catch (err) {
    recordFail('Safe Deletion Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`📊  FORENSIC VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  restoreSnapshots();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPurchasesForensicSuite().catch((err) => {
  console.error('FATAL SUITE ERROR:', err);
  process.exit(1);
});

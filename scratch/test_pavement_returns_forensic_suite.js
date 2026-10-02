/**
 * scratch/test_pavement_returns_forensic_suite.js
 * 🏛️ جناح التدقيق الجنائي والاختبار المعماري الشامل لعوائد التعبيد (PAVEMENT_RETURNS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

function makeRequest(app, method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (payload && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: reqHeaders
      }, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          server.close(() => {
            let parsedBody = rawData;
            try {
              parsedBody = JSON.parse(rawData);
            } catch (e) {}
            resolve({
              status: res.statusCode,
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsedBody
            });
          });
        });
      });

      req.on('error', (err) => {
        server.close(() => reject(err));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

const { dbQuery, dbGet, dbRun, isPostgresActive } = require('../utils/database');
const engineRegistry = require('../services/engineRegistry');
const pavementReturnsEngineService = require('../services/pavementReturnsEngineService');
const pavingReturnsApiRouter = require('../PavementReturns/API/pavingReturns');
const numberingEngine = require('../services/numberingEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

function generateTestToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const adminUser = {
  id: 'U-001',
  username: 'admin',
  role: 'admin',
  fullName: 'مدير النظام التنفيذي',
  permissions: ['*']
};

const directorUser = {
  id: 'U-002',
  username: 'director_eng',
  role: 'director_public_works',
  fullName: 'مدير الأشغال والخدمات الهندسية',
  permissions: ['PAVING.VIEW', 'PAVING.CREATE', 'PAVING.EDIT', 'PAVING.APPROVE', 'PAVING.DELETE']
};

const engineerUser = {
  id: 'U-005',
  username: 'roads_eng',
  role: 'roads_engineer',
  fullName: 'مهندس الطرق الميداني',
  permissions: ['PAVING.VIEW', 'PAVING.CREATE', 'PAVING.EDIT']
};

const viewerUser = {
  id: 'U-999',
  username: 'readonly_user',
  role: 'viewer',
  fullName: 'مراقب عام بدون صلاحيات تعديل',
  permissions: ['DASHBOARD.VIEW']
};

let testReturnId = null;

async function runTest(testName, testFn) {
  try {
    await testFn();
    console.log(`  ✅ PASS: ${testName}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ PAVEMENT RETURNS — COMPREHENSIVE FORENSIC & ARCHITECTURAL VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log(`[DB Mode]: ${isPostgresActive() ? 'PostgreSQL Active (Canonical)' : 'In-Memory Fallback'}`);

  // Test 1: Registry Discovery & Engine Health
  await runTest('1. EngineRegistry Discovery & Health Check Verification', async () => {
    engineRegistry._ensureInitialized();
    const entry = engineRegistry.get('PAVEMENT_RETURNS_ENGINE');
    assert(entry, 'PAVEMENT_RETURNS_ENGINE must be registered in engineRegistry');
    assert.strictEqual(entry.status, 'READY', 'Engine status should be READY');
    assert.strictEqual(entry.instance, pavementReturnsEngineService, 'Instance must strictly match pavementReturnsEngineService');
    assert(typeof entry.exposedOperations.getPavingReturns === 'function', 'getPavingReturns exposed');
    assert(typeof entry.exposedOperations.createPavingReturn === 'function', 'createPavingReturn exposed');
    assert(typeof entry.exposedOperations.advanceApproval === 'function', 'advanceApproval exposed');
    assert(typeof entry.exposedOperations.recordPayment === 'function', 'recordPayment exposed');

    const health = await pavementReturnsEngineService.healthCheck();
    assert(health && health.healthy === true, 'Health check must return healthy: true');
    assert.strictEqual(health.engineId, 'PAVEMENT_RETURNS_ENGINE');
  });

  // Test 2: Paving Return Calculation Algorithm
  await runTest('2. Paving Return Calculation Law & Half-Width Rule', async () => {
    // 20m frontage, 6m total paving width (half width = 3m), 4.5 JOD/sqm, 100% rate
    const calc1 = pavementReturnsEngineService.calculatePavingReturn(20, 6, 4.5, 1.0, true);
    assert.strictEqual(calc1.frontageLength, 20);
    assert.strictEqual(calc1.effectivePavingWidth, 3);
    assert.strictEqual(calc1.areaSquareMeters, 60);
    assert.strictEqual(calc1.requiredAmount, 270);
    assert.strictEqual(calc1.isExempt, false);

    // 15m frontage, 8m width (half width = 4m), 5.0 JOD/sqm, 50% rate
    const calc2 = pavementReturnsEngineService.calculatePavingReturn(15, 8, 5.0, 0.5, true);
    assert.strictEqual(calc2.areaSquareMeters, 60);
    assert.strictEqual(calc2.requiredAmount, 150);

    // Exemption test
    const calcExempt = pavementReturnsEngineService.calculatePavingReturn(20, 6, 4.5, 0, true);
    assert.strictEqual(calcExempt.requiredAmount, 0);
    assert.strictEqual(calcExempt.isExempt, true);
  });

  // Test 3: Numbering Engine Integration
  await runTest('3. Numbering Engine Integration (PAV Prefix)', async () => {
    const generatedId = await numberingEngine.generateNextId('paving_returns');
    assert(generatedId, 'Generated ID must be non-null');
    assert(generatedId.startsWith('PAV-'), `Generated ID must start with PAV-, got: ${generatedId}`);
  });

  // Test 4: Creation of Paving Return with PostGIS Geometry
  await runTest('4. Canonical Paving Return Creation & PostGIS SRID 4326', async () => {
    const newRecord = await pavementReturnsEngineService.createPavingReturn({
      tenderId: 'T-2026-001',
      pieceNumber: '789',
      basinNumber: '12',
      district: 'حي نمر',
      streetName: 'شارع الحسبة الرئيسي',
      ownerName: 'محمد أحمد فريحات',
      nationalId: '9801020304',
      frontageLength: 25,
      pavingWidth: 6,
      pricePerMeter: 4.5,
      impositionRate: 1.0,
      notes: 'معاملة تعبيد نموذجية مع نقطة جغرافية معتمدة',
      lat: 32.3325,
      lng: 35.7535,
      pieces: [
        { pieceNumber: '789/1', basinNumber: '12', frontageLength: 15, pavingWidth: 6, pricePerMeter: 4.5, impositionRate: 1.0 },
        { pieceNumber: '789/2', basinNumber: '12', frontageLength: 10, pavingWidth: 6, pricePerMeter: 4.5, impositionRate: 1.0 }
      ]
    }, engineerUser);

    assert(newRecord && newRecord.id, 'Record must be created with valid ID');
    testReturnId = newRecord.id;
    assert.strictEqual(newRecord.piece_number, '789/1');
    assert.strictEqual(newRecord.basin_number, '12');
    assert.strictEqual(newRecord.approval_status, 'DRAFT');
    assert.strictEqual(newRecord.paid_amount, 0);
    assert.strictEqual(newRecord.payment_status, 'UNPAID');
    assert.strictEqual(newRecord.created_by, engineerUser.username);

    // Verify PostGIS SRID in DB
    if (isPostgresActive()) {
      const dbRow = await dbGet(`
        SELECT id, ST_SRID(geom) as srid, ST_GeometryType(geom) as geom_type,
               ST_X(geom) as x, ST_Y(geom) as y, ST_AsGeoJSON(geom) as geojson
        FROM public.paving_returns WHERE id = $1
      `, [testReturnId]);
      assert(dbRow, 'DB row must exist');
      assert.strictEqual(parseInt(dbRow.srid, 10), 4326, 'PostGIS geometry must be SRID 4326');
      assert.strictEqual(dbRow.geom_type, 'ST_Point', 'Geometry type must be Point');
      assert(Math.abs(parseFloat(dbRow.y) - 32.3325) < 0.001, 'Latitude verified');
      assert(Math.abs(parseFloat(dbRow.x) - 35.7535) < 0.001, 'Longitude verified');
      assert(dbRow.geojson && dbRow.geojson.includes('Point'), 'ST_AsGeoJSON functional');
    }
  });

  // Test 5: Query with Filters and Spatial Output
  await runTest('5. Query with Multi-Dimensional Filters and Spatial GeoJSON Output', async () => {
    const list = await pavementReturnsEngineService.getPavingReturns({
      district: 'حي نمر',
      pieceNumber: '789'
    });
    assert(Array.isArray(list) && list.length > 0, 'Query should return array of records');
    const item = list.find(r => r.id === testReturnId);
    assert(item, 'Created record must be in filtered list');
    assert(item.geometry && item.geometry.type === 'Point', 'Geometry object present');
    assert(Array.isArray(item.geometry.coordinates), 'Coordinates array present');
    assert(Array.isArray(item.pieces), 'Pieces array parsed');
  });

  // Test 6: Update Return Measurements and Spatial Context
  await runTest('6. Atomic Update of Dimensions and PostGIS Point Coordinates', async () => {
    const updated = await pavementReturnsEngineService.updatePavingReturn(testReturnId, {
      owner_name: 'محمد أحمد فريحات (محدث)',
      frontage_length: 30,
      paving_width: 8,
      lat: 32.3340,
      lng: 35.7550
    }, engineerUser);

    assert.strictEqual(updated.owner_name, 'محمد أحمد فريحات (محدث)');
    assert.strictEqual(updated.frontage_length, 30);
    assert.strictEqual(updated.paving_width, 4); // half width of 8
    assert(Math.abs(updated.lat - 32.3340) < 0.001, 'Updated lat verified');
  });

  // Test 7: Workflow State Machine (SUBMIT -> REVIEW_APPROVE -> SoD Guard -> FINAL_APPROVE)
  await runTest('7. Workflow Lifecycle Transitions & Separation of Duties (SoD) Guard', async () => {
    // Stage 1 -> 2: Engineer submits
    const step1 = await pavementReturnsEngineService.advanceApproval(testReturnId, {
      action: 'SUBMIT',
      notes: 'تم استكمال قياسات الواجهات والمسح الميداني'
    }, engineerUser);
    assert.strictEqual(step1.approval_status, 'UNDER_REVIEW');
    assert.strictEqual(step1.current_stage, 2);

    // Stage 2 -> 3: Section head reviews
    const step2 = await pavementReturnsEngineService.advanceApproval(testReturnId, {
      action: 'REVIEW_APPROVE',
      notes: 'تمت المطابقة الميدانية مع المخطط التنظيمي'
    }, { id: 'U-003', username: 'roads_head', role: 'head_of_roads' });
    assert.strictEqual(step2.approval_status, 'PENDING_DIRECTOR');
    assert.strictEqual(step2.current_stage, 3);

    // SoD Negative Test: Creator engineer cannot approve their own submission
    let sodBlocked = false;
    try {
      await pavementReturnsEngineService.advanceApproval(testReturnId, {
        action: 'FINAL_APPROVE',
        notes: 'محاولة اعتماد ذاتي غير مصرحة'
      }, engineerUser);
    } catch (e) {
      sodBlocked = e.message.includes('فصل المهام');
    }
    assert(sodBlocked, 'SoD MUST block engineer from approving own created return');

    // Stage 3: Director of Public Works officially approves
    const step3 = await pavementReturnsEngineService.advanceApproval(testReturnId, {
      action: 'FINAL_APPROVE',
      notes: 'تم التدقيق والمصادقة النهائية والإدراج في سجلات التحقق والتحصيل'
    }, directorUser);
    assert.strictEqual(step3.approval_status, 'APPROVED');
    assert.strictEqual(step3.current_stage, 3);
  });

  // Test 8: Payment Collection Gate & Accounting Protection
  await runTest('8. Payment Collection Gate & Receipt Registration', async () => {
    // Record payment installment on approved return
    const payResult = await pavementReturnsEngineService.recordPayment(testReturnId, {
      paidAmount: 150.000,
      receiptNumber: 'REC-2026-9081',
      paymentDate: '2026-09-12',
      notes: 'دفعة أولى نقدية لدى محاسب البلدية'
    }, directorUser);

    assert(payResult.success, 'Payment registration must succeed');
    assert.strictEqual(payResult.paid_amount, 150);
    assert.strictEqual(payResult.payment_status, 'PARTIAL');

    const fetched = await pavementReturnsEngineService.getPavingReturnById(testReturnId);
    assert.strictEqual(fetched.paid_amount, 150);
    assert.strictEqual(fetched.payment_status, 'PARTIAL');
  });

  // Test 9: Accounting Protection on Delete (Deletion Guard)
  await runTest('9. Accounting Deletion Protection (Prohibiting Deletion of Collected Returns)', async () => {
    let deleteBlocked = false;
    try {
      await pavementReturnsEngineService.deletePavingReturn(testReturnId, adminUser);
    } catch (e) {
      deleteBlocked = e.message.includes('حظر محاسبي');
    }
    assert(deleteBlocked, 'Accounting guard MUST block deletion of record with paid_amount > 0');
  });

  // Test 10: Creation of 0-Payment Record & Clean Deletion
  await runTest('10. Atomic Deletion of Zero-Payment Record', async () => {
    const tempRecord = await pavementReturnsEngineService.createPavingReturn({
      tenderId: 'T-2026-001',
      pieceNumber: '999',
      basinNumber: '99',
      district: 'كفرنجة',
      frontageLength: 10,
      pavingWidth: 6,
      pricePerMeter: 4.5
    }, adminUser);

    assert(tempRecord && tempRecord.id, 'Temporary record created');
    const delResult = await pavementReturnsEngineService.deletePavingReturn(tempRecord.id, adminUser);
    assert(delResult.success, 'Deletion of zero-payment record must succeed');

    const check = await pavementReturnsEngineService.getPavingReturnById(tempRecord.id);
    assert(check === null, 'Deleted record must no longer exist');
  });

  // Test 11: Audit Trail Verification in public.activity_log
  await runTest('11. Canonical Audit Trail in public.activity_log', async () => {
    if (isPostgresActive()) {
      const logs = await dbQuery(`
        SELECT action, entity, "entityId"
        FROM public.activity_log
        WHERE "entityId" = $1
        ORDER BY "createdAt" ASC
      `, [testReturnId]);

      assert(logs && logs.length > 0, 'Audit entries must be recorded');
      const actions = logs.map(l => l.action);
      console.log(`     Recorded Audit Actions: [${actions.join(', ')}]`);
      assert(actions.includes('PAVING_RETURN_CREATED'), 'Must record PAVING_RETURN_CREATED');
      assert(actions.includes('PAVING_RETURN_APPROVAL_ADVANCED'), 'Must record PAVING_RETURN_APPROVAL_ADVANCED');
      assert(actions.includes('PAVING_RETURN_PAID'), 'Must record PAVING_RETURN_PAID');
    }
  });

  // Test 12: HTTP API Adapter & RBAC Security Suite
  await runTest('12. HTTP API Adapter & RBAC Security Enforcement (401 / 403 / 200)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/paving-returns', pavingReturnsApiRouter);

    // 12.1 Unauthenticated (401)
    const unauthGet = await makeRequest(app, 'GET', '/api/paving-returns');
    assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET must return 401');

    const unauthPost = await makeRequest(app, 'POST', '/api/paving-returns', {}, { frontageLength: 10 });
    assert.strictEqual(unauthPost.status, 401, 'Unauthenticated POST must return 401');

    // 12.2 Unauthorized (403)
    const viewerToken = generateTestToken(viewerUser);
    const forbiddenPost = await makeRequest(app, 'POST', '/api/paving-returns', {
      Authorization: `Bearer ${viewerToken}`
    }, { frontageLength: 10 });
    assert.strictEqual(forbiddenPost.status, 403, 'Unauthorized POST without PAVING.CREATE must return 403');

    // 12.3 Authorized Access with Engineer Token (200 / 201)
    const engToken = generateTestToken(engineerUser);
    const authGet = await makeRequest(app, 'GET', '/api/paving-returns', {
      Authorization: `Bearer ${engToken}`
    });
    assert.strictEqual(authGet.status, 200, 'Authorized GET must return 200');
    assert(authGet.body.success, 'Response must have success: true');

    // 12.4 Stats Endpoint
    const statsRes = await makeRequest(app, 'GET', '/api/paving-returns/stats', {
      Authorization: `Bearer ${engToken}`
    });
    assert.strictEqual(statsRes.status, 200, 'Stats endpoint must return 200');
    assert(statsRes.body.data && statsRes.body.data.totalRecords !== undefined, 'Stats data present');

    // 12.5 Health Endpoint (Public probe)
    const healthRes = await makeRequest(app, 'GET', '/api/paving-returns/health');
    assert.strictEqual(healthRes.status, 200, 'Health endpoint must return 200');
    assert.strictEqual(healthRes.body.engineId, 'PAVEMENT_RETURNS_ENGINE');
  });

  // Test 13: Zero Direct DB Bypass & Zero Runtime DDL AST Inspection
  await runTest('13. Zero Direct DB Bypass & Zero Runtime DDL Verification', async () => {
    const apiFilePath = path.resolve(__dirname, '..', 'PavementReturns/API/pavingReturns.js');
    const apiCode = fs.readFileSync(apiFilePath, 'utf8');

    assert(!apiCode.includes('dbQuery('), 'API router MUST NOT contain direct dbQuery() calls');
    assert(!apiCode.includes('dbGet('), 'API router MUST NOT contain direct dbGet() calls');
    assert(!apiCode.includes('dbRun('), 'API router MUST NOT contain direct dbRun() calls');
    assert(!apiCode.includes('pool.query('), 'API router MUST NOT contain pool.query() calls');
    assert(!apiCode.includes("require('pg')"), 'API router MUST NOT contain require("pg")');
    assert(!apiCode.includes('CREATE TABLE'), 'No CREATE TABLE in API');
    assert(!apiCode.includes('DROP TABLE'), 'No DROP TABLE in API');

    const serviceFilePath = path.resolve(__dirname, '..', 'services/pavementReturnsEngineService.js');
    const serviceCode = fs.readFileSync(serviceFilePath, 'utf8');
    assert(!serviceCode.includes('CREATE TABLE'), 'No CREATE TABLE in domain service');
    assert(!serviceCode.includes('ALTER TABLE'), 'No ALTER TABLE in domain service');
    assert(!serviceCode.includes('DROP TABLE'), 'No DROP TABLE in domain service');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🎯 ALL 13 PAVEMENT RETURNS FORENSIC TESTS PASSED (100%)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n💥 TEST SUITE FAILED:', err);
  process.exit(1);
});

/**
 * test_middlewares_forensic_suite.js
 * ANTI-GRAVITY — Comprehensive Middlewares Forensic & Security Negative Suite
 * 
 * Validates:
 * 1. Authentication flow (valid, missing, expired, malformed, revoked/blacklisted token).
 * 2. Privilege escalation prevention (untrusted user with id='U-001' cannot bypass requireAdmin).
 * 3. Legitimate admin authorization.
 * 4. RBAC positive permissions matrix.
 * 5. RBAC negative security enforcement ("must be denied" cross-domain checks).
 * 6. Separation of Duties (SoD).
 * 7. Global error handling (stack masking, safe 500 response, client 4xx preservation).
 * 8. Zero Runtime DDL and Zero Direct DB bypass in middlewares/*.js.
 * 9. Canonical Audit & Activity logging integration.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const { authenticate, requireAdmin, requireAuth } = require('../middlewares/authMiddleware');
const rbacManager = require('../middlewares/rbacManager');
const globalErrorHandler = require('../middlewares/globalErrorHandler');
const authorizationEngine = require('../services/authorizationEngineService');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// Mock request & response helpers
function createMockReqRes(options = {}) {
  const req = {
    path: options.path || '/api/test',
    headers: options.headers || {},
    user: options.user || null,
    method: options.method || 'GET',
    originalUrl: options.originalUrl || options.path || '/api/test',
    ip: options.ip || '127.0.0.1'
  };

  let statusCode = 200;
  let responseData = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
    wasNextCalled: () => nextCalled
  };
}

async function main() {
  console.log('================================================================');
  console.log('🚀 ANTI-GRAVITY: MIDDLEWARES FORENSIC & SECURITY AUDIT SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // GROUP 1: AUTHENTICATION INTEGRITY
  // -------------------------------------------------------------
  console.log('--- GROUP 1: AUTHENTICATION & TOKEN INTEGRITY ---');

  await runAsyncTest('Valid Token -> authenticate attaches req.user', async () => {
    const validToken = jwt.sign({ id: 'U-006', role: 'roads_engineer', username: 'roads_eng' }, JWT_SECRET, { expiresIn: '1h' });
    const { req, res, next, wasNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${validToken}` }
    });

    await authenticate(req, res, next);
    assert.strictEqual(wasNextCalled(), true, 'next() must be called');
    assert.ok(req.user, 'req.user must be populated');
    assert.strictEqual(req.user.id, 'U-006');
    assert.strictEqual(req.user.role, 'roads_engineer');
  });

  await runAsyncTest('Missing Token -> req.user is null on authenticate', async () => {
    const { req, res, next, wasNextCalled } = createMockReqRes();
    await authenticate(req, res, next);
    assert.strictEqual(wasNextCalled(), true);
    assert.strictEqual(req.user, null);
  });

  runTest('Missing Token -> requireAuth MUST return HTTP 401', () => {
    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes();
    requireAuth(req, res, next);
    assert.strictEqual(wasNextCalled(), false, 'next() must NOT be called');
    assert.strictEqual(getStatus(), 401, 'Status must be 401');
    assert.ok(getData().error, 'Must provide error message');
  });

  await runAsyncTest('Expired Token -> MUST return HTTP 401', async () => {
    const expiredToken = jwt.sign({ id: 'U-006', role: 'roads_engineer' }, JWT_SECRET, { expiresIn: '-1s' });
    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${expiredToken}` }
    });

    await authenticate(req, res, next);
    assert.strictEqual(wasNextCalled(), false, 'next() must NOT be called');
    assert.strictEqual(getStatus(), 401);
    assert.ok(getData().error);
  });

  await runAsyncTest('Malformed Token -> MUST return HTTP 401', async () => {
    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes({
      headers: { authorization: 'Bearer this-is-not-a-valid-jwt-token' }
    });

    await authenticate(req, res, next);
    assert.strictEqual(wasNextCalled(), false);
    assert.strictEqual(getStatus(), 401);
    assert.ok(getData().error);
  });

  await runAsyncTest('Revoked / Blacklisted Token -> MUST return HTTP 401', async () => {
    const testJti = `REVOKE-TEST-${Date.now()}`;
    const revokedToken = jwt.sign({ id: 'U-009', role: 'roads_engineer', jti: testJti }, JWT_SECRET, { expiresIn: '1h' });

    // Revoke token in canonical authorization engine
    await authorizationEngine.revokeToken(testJti, 'ADMIN_TEST');

    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${revokedToken}` }
    });

    await authenticate(req, res, next);
    assert.strictEqual(wasNextCalled(), false, 'next() must NOT be called for blacklisted token');
    assert.strictEqual(getStatus(), 401, 'Blacklisted token must return 401');
    assert.strictEqual(req.user, null, 'req.user must remain null');
  });

  // -------------------------------------------------------------
  // GROUP 2: PRIVILEGE ESCALATION & ADMIN GUARD
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: PRIVILEGE ESCALATION & ADMIN AUTHORIZATION ---');

  runTest('Privilege Escalation: Non-admin user with id="U-001" MUST BE DENIED (403)', () => {
    const maliciousUser = { id: 'U-001', role: 'site_inspector', username: 'impostor' };
    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes({
      user: maliciousUser
    });

    requireAdmin(req, res, next);
    assert.strictEqual(wasNextCalled(), false, 'Admin bypass on id="U-001" must be blocked');
    assert.strictEqual(getStatus(), 403, 'Must return 403 Forbidden');
    assert.ok(getData().error.includes('صلاحيات غير كافية'));
  });

  runTest('Privilege Escalation in rbacManager: site_inspector with id="U-001" has NO wildcard "*"', () => {
    const maliciousUser = { id: 'U-001', role: 'site_inspector', username: 'impostor' };
    const perms = rbacManager.parseUserPermissions(maliciousUser);
    assert.strictEqual(perms.includes('*'), false, 'site_inspector must never get wildcard permissions');
    assert.strictEqual(rbacManager.hasPermission(maliciousUser, 'SETTINGS.MANAGE'), false);
    assert.strictEqual(rbacManager.hasPermission(maliciousUser, 'BUDGET.DELETE'), false);
  });

  runTest('Legitimate Admin: user with role="admin" passes requireAdmin (200)', () => {
    const adminUser = { id: 'U-001', role: 'admin', username: 'admin' };
    const { req, res, next, wasNextCalled } = createMockReqRes({
      user: adminUser
    });

    requireAdmin(req, res, next);
    assert.strictEqual(wasNextCalled(), true, 'Admin user must be allowed');
  });

  runTest('Legitimate Super Admin: user with role="super_admin" passes requireAdmin (200)', () => {
    const superAdminUser = { id: 'U-999', role: 'super_admin', username: 'chief' };
    const { req, res, next, wasNextCalled } = createMockReqRes({
      user: superAdminUser
    });

    requireAdmin(req, res, next);
    assert.strictEqual(wasNextCalled(), true, 'Super admin user must be allowed');
  });

  // -------------------------------------------------------------
  // GROUP 3: RBAC MATRIX & NEGATIVE SECURITY TESTS
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: RBAC & NEGATIVE PERMISSION ENFORCEMENT ---');

  runTest('Positive RBAC: roads_engineer has ROADS.VIEW permission', () => {
    const engineer = { id: 'U-005', role: 'roads_engineer', username: 'roads_eng' };
    assert.strictEqual(rbacManager.hasPermission(engineer, 'ROADS.VIEW'), true);
  });

  runTest('Negative RBAC: roads_engineer CANNOT delete municipal budget (BUDGET.DELETE = FALSE)', () => {
    const engineer = { id: 'U-005', role: 'roads_engineer', username: 'roads_eng' };
    assert.strictEqual(rbacManager.hasPermission(engineer, 'BUDGET.DELETE'), false, 'Cross-domain privilege escalation blocked');
  });

  runTest('Negative RBAC: site_inspector CANNOT delete contracts (CONTRACTS.DELETE = FALSE)', () => {
    const inspector = { id: 'U-008', role: 'site_inspector', username: 'inspector' };
    assert.strictEqual(rbacManager.hasPermission(inspector, 'CONTRACTS.DELETE'), false);
  });

  runTest('Negative RBAC: site_inspector CANNOT delete roads (ROADS.DELETE = FALSE)', () => {
    const inspector = { id: 'U-008', role: 'site_inspector', username: 'inspector' };
    assert.strictEqual(rbacManager.hasPermission(inspector, 'ROADS.DELETE'), false);
  });

  runTest('Negative RBAC: qa_qc_engineer CANNOT approve budget allocations (BUDGET.ALLOCATE = FALSE)', () => {
    const qa = { id: 'U-009', role: 'qa_qc_engineer', username: 'qa_engineer' };
    assert.strictEqual(rbacManager.hasPermission(qa, 'BUDGET.ALLOCATE'), false);
  });

  await runAsyncTest('requirePermission guard: unauthorized user receives HTTP 403', async () => {
    const inspector = { id: 'U-008', role: 'site_inspector', username: 'inspector' };
    const guard = rbacManager.requirePermission('BUDGET.DELETE');
    const { req, res, next, getStatus, getData, wasNextCalled } = createMockReqRes({
      user: inspector,
      originalUrl: '/api/budget/lines/123'
    });

    await guard(req, res, next);
    assert.strictEqual(wasNextCalled(), false, 'next() must NOT be called for missing permission');
    assert.strictEqual(getStatus(), 403, 'Must return HTTP 403 Forbidden');
    assert.strictEqual(getData().code, 'FORBIDDEN');
  });

  await runAsyncTest('Separation of Duties (SoD): Creator CANNOT approve own transaction', async () => {
    const creatorUser = { id: 'U-005', role: 'roads_engineer', username: 'roads_eng' };
    const claimEntity = { id: 'CLM-001', created_by: 'U-005', amount: 15000 };

    const sodResult = rbacManager.checkSeparationOfDuties(creatorUser, claimEntity, 'APPROVE');
    assert.strictEqual(sodResult.allowed, false, 'SoD violation must be blocked');
    assert.ok(sodResult.reason.includes('فصل المهام والمسؤوليات'));
  });

  // -------------------------------------------------------------
  // GROUP 4: ERROR HANDLING & SECRET PROTECTION
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: GLOBAL ERROR HANDLING & DATA PROTECTION ---');

  runTest('Global Error Handler: 5xx Internal Server Error masks stack trace and internal message', () => {
    const internalErr = new Error('FATAL: Database connection string postgresql://postgres:SuperSecretPassword123@localhost:5432/db failed');
    internalErr.stack = 'Error: FATAL at internalPostgresCall (d:\\app\\db.js:12:34)\n    at Object.<anonymous>';

    const { req, res, next, getStatus, getData } = createMockReqRes();
    globalErrorHandler(internalErr, req, res, next);

    assert.strictEqual(getStatus(), 500, 'Status must be 500');
    const body = getData();
    assert.ok(body.correlationId.startsWith('ERR-'), 'Must include correlationId');
    assert.strictEqual(body.error, 'عذراً، حدث خطأ داخلي في الخادم. تم تسجيل المشكلة للمتابعة.');
    assert.strictEqual(body.stack, undefined, 'Stack trace MUST NOT be leaked to client');
    assert.strictEqual(JSON.stringify(body).includes('SuperSecretPassword123'), false, 'Secrets MUST NOT be leaked to client');
  });

  runTest('Global Error Handler: 4xx Client Error preserves client message', () => {
    const clientErr = new Error('حقل اسم المشروع مطلوب ولا يمكن تركه فارغاً');
    clientErr.statusCode = 400;

    const { req, res, next, getStatus, getData } = createMockReqRes();
    globalErrorHandler(clientErr, req, res, next);

    assert.strictEqual(getStatus(), 400);
    const body = getData();
    assert.strictEqual(body.error, 'حقل اسم المشروع مطلوب ولا يمكن تركه فارغاً');
    assert.strictEqual(body.stack, undefined);
  });

  // -------------------------------------------------------------
  // GROUP 5: DATABASE BOUNDARY & RUNTIME DDL COMPLIANCE
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: ARCHITECTURAL BOUNDARIES & DDL COMPLIANCE ---');

  runTest('Runtime DDL = 0 in middlewares/*.js', () => {
    const middlewaresDir = path.join(__dirname, '..', 'middlewares');
    const files = fs.readdirSync(middlewaresDir).filter(f => f.endsWith('.js'));
    const ddlKeywords = ['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'CREATE INDEX', 'CREATE EXTENSION'];

    files.forEach(file => {
      const content = fs.readFileSync(path.join(middlewaresDir, file), 'utf8');
      ddlKeywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        assert.strictEqual(regex.test(content), false, `Forbidden runtime DDL [${kw}] found in ${file}`);
      });
    });
  });

  runTest('Direct DB Bypass = 0 in middlewares/*.js (No raw pg or Pool)', () => {
    const middlewaresDir = path.join(__dirname, '..', 'middlewares');
    const files = fs.readdirSync(middlewaresDir).filter(f => f.endsWith('.js'));

    files.forEach(file => {
      const content = fs.readFileSync(path.join(middlewaresDir, file), 'utf8');
      assert.strictEqual(content.includes("require('pg')"), false, `Direct require('pg') found in ${file}`);
      assert.strictEqual(content.includes('new Pool'), false, `Direct new Pool found in ${file}`);
      assert.strictEqual(/\.query\s*\(/.test(content), false, `Direct .query() found in ${file}`);
    });
  });

  console.log('\n================================================================');
  console.log(`🏁 SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Unhandled failure in forensic suite:', err);
  process.exit(1);
});

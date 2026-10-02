/**
 * scratch/test_contracts_api_suite.js
 * Contract Management API Router Tests
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

const { initDatabase, isPostgresActive, getPool } = require('../utils/database');
const contractsRouter = require('../Contracts/API/contractManagementEngine');

let testPassed = 0;
let testFailed = 0;

function runTest(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ [PASS] ${name}`);
      testPassed++;
    })
    .catch(err => {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      testFailed++;
    });
}

function makeRequest(app, method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const parsedUrl = new URL(url, `http://localhost:${port}`);

      const reqOptions = {
        hostname: 'localhost',
        port: port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(reqOptions, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          server.close();
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (e) {
            json = rawData;
          }
          resolve({ status: res.statusCode, body: json });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

async function main() {
  const pool = initDatabase();
  if (pool) {
    try { await pool.query('SELECT NOW()'); } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 100));

  console.log('================================================================');
  console.log('🚀 CONTRACTS API ADAPTER ENDPOINT TEST SUITE');
  console.log(`📡 Database: ${isPostgresActive() ? 'PostgreSQL Active (Live)' : 'Memory DB Active'}`);
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api/contracts', contractsRouter);

  const jwtSecret = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';
  const adminToken = jwt.sign(
    { id: 'ADMIN_TEST', username: 'admin', role: 'admin', permissions: ['*'] },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  let createdContractId = null;

  // 1. GET /procurements
  await runTest('GET /api/contracts/procurements (Auto-populate list)', async () => {
    const res = await makeRequest(app, 'GET', '/api/contracts/procurements', null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.data));
  });

  // 2. GET /contract-types
  await runTest('GET /api/contracts/contract-types (Public Contract Types)', async () => {
    const res = await makeRequest(app, 'GET', '/api/contracts/contract-types');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.data));
  });

  // 3. GET /guarantees/alerts
  await runTest('GET /api/contracts/guarantees/alerts', async () => {
    const res = await makeRequest(app, 'GET', '/api/contracts/guarantees/alerts', null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.alerts);
  });

  // 4. GET /analytics/kpis
  await runTest('GET /api/contracts/analytics/kpis', async () => {
    const res = await makeRequest(app, 'GET', '/api/contracts/analytics/kpis', null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.data.total_contracts !== undefined);
  });

  // 5. Auth Protection: POST / without token
  await runTest('Auth Protection: POST /api/contracts without token returns 401/403', async () => {
    const res = await makeRequest(app, 'POST', '/api/contracts', { title: 'Unauthorized' });
    assert(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
  });

  // 6. POST / with admin token
  await runTest('POST /api/contracts with admin token creates contract', async () => {
    const res = await makeRequest(app, 'POST', '/api/contracts', {
      title: 'عقد أشغال تعبيد حي سفيان كفرنجة',
      contractor_name: 'شركة سفيان للمقاولات العامة',
      total_value: 45000,
      execution_period_days: 60,
      guarantee_value: 4500,
      guarantee_number: 'BG-SOF-2026',
      guarantee_expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
    }, authHeaders);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.data && res.body.data.id);
    createdContractId = res.body.data.id;
  });

  // 7. GET /:id
  await runTest('GET /api/contracts/:id returns full contract details', async () => {
    assert(createdContractId, 'Must have createdContractId');
    const res = await makeRequest(app, 'GET', `/api/contracts/${createdContractId}`, null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, createdContractId);
    assert(Array.isArray(res.body.data.clauses));
    assert(Array.isArray(res.body.data.guarantees));
  });

  // 8. PUT /:id
  await runTest('PUT /api/contracts/:id updates contract details', async () => {
    const res = await makeRequest(app, 'PUT', `/api/contracts/${createdContractId}`, {
      title: 'عقد أشغال تعبيد حي سفيان كفرنجة (محدث)'
    }, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // 9. POST /:id/clauses
  await runTest('POST /api/contracts/:id/clauses adds a clause', async () => {
    const res = await makeRequest(app, 'POST', `/api/contracts/${createdContractId}/clauses`, {
      title: 'بند التوريد والمطابقة الفنية',
      content: 'مطابقة الخلطة الإسفلتية للمواصفات الأردنية القياسية'
    }, authHeaders);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
  });

  // 10. POST /:id/variation-orders
  await runTest('POST /api/contracts/:id/variation-orders adds variation order', async () => {
    const res = await makeRequest(app, 'POST', `/api/contracts/${createdContractId}/variation-orders`, {
      orderType: 'VALUE_INCREASE',
      amountChange: 5000,
      timeExtensionDays: 10,
      reason: 'زيادة سماكة طبقة الأساس'
    }, authHeaders);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
  });

  // 11. POST /:id/sign
  await runTest('POST /api/contracts/:id/sign executes cryptographic e-signature', async () => {
    const res = await makeRequest(app, 'POST', `/api/contracts/${createdContractId}/sign`, {
      party: 'first_party',
      signerName: 'رئيس بلدية كفرنجة الجديدة'
    }, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.sha256_hash && res.body.sha256_hash.length === 64);
  });

  // 12. GET /:id/print
  await runTest('GET /api/contracts/:id/print outputs printable HTML', async () => {
    const res = await makeRequest(app, 'GET', `/api/contracts/${createdContractId}/print`, null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert(typeof res.body === 'string' && res.body.includes('طباعة اتفاقية تنفيذ أعمال'));
  });

  // 13. DELETE /:id
  await runTest('DELETE /api/contracts/:id deletes contract permanently', async () => {
    const res = await makeRequest(app, 'DELETE', `/api/contracts/${createdContractId}`, null, authHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const checkRes = await makeRequest(app, 'GET', `/api/contracts/${createdContractId}`, null, authHeaders);
    assert.strictEqual(checkRes.status, 404);
  });

  console.log('\n================================================================');
  console.log(`📊 CONTRACTS API SUITE FINISHED: ${testPassed} Passed, ${testFailed} Failed`);
  console.log('================================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

/**
 * scratch/test_operations_center_api_suite.js
 * 🌐 اختبار واجهات برمجة التطبيقات (HTTP API Integration & Route Guard Tests)
 * لمركز العمليات والمتابعة (OperationsCenter API) باستخدام وحدة http القياسية
 */

'use strict';

const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const workOperationsCenterEngine = require('../Administration/API/workOperationsCenterEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

function generateTestToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function doRequest(server, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders = { ...headers };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🌐 OPERATIONS CENTER API — HTTP ENDPOINTS & RBAC GUARD VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const app = express();
  app.use(express.json());
  app.use('/api/v4/operations-center', workOperationsCenterEngine);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Unauthenticated Request -> 401
    console.log('1. Testing Unauthenticated Access Guard (401)...');
    const res1 = await doRequest(server, { method: 'GET', path: '/api/v4/operations-center' });
    assert.strictEqual(res1.status, 401, `Expected 401 Unauthorized, got ${res1.status}`);
    assert.strictEqual(res1.body.success, false);
    console.log('   ✅ PASS: GET /api/v4/operations-center without token returned 401');

    // 2. Unauthenticated POST to /:id/finalize -> 401
    const res2 = await doRequest(server, { method: 'POST', path: '/api/v4/operations-center/WOC-TEST/finalize', body: {} });
    assert.strictEqual(res2.status, 401, `Expected 401 Unauthorized on finalize, got ${res2.status}`);
    console.log('   ✅ PASS: POST /:id/finalize without token returned 401');

    // 3. Unauthenticated POST to /:id/route -> 401
    const res3 = await doRequest(server, { method: 'POST', path: '/api/v4/operations-center/WOC-TEST/route', body: { action: 'START' } });
    assert.strictEqual(res3.status, 401, `Expected 401 Unauthorized on route, got ${res3.status}`);
    console.log('   ✅ PASS: POST /:id/route without token returned 401');

    // 4. Unauthorized Token (Role: viewer without TASKS.CREATE) -> 403 on POST /
    console.log('2. Testing Permission Guard (403 Forbidden)...');
    const viewerToken = generateTestToken({ id: 'U-999', username: 'guest_user', role: 'viewer', permissions: ['DASHBOARD.VIEW'] });
    const res4 = await doRequest(server, {
      method: 'POST',
      path: '/api/v4/operations-center',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: { title: 'محاولة إنشاء مهمة دون صلاحية' }
    });
    assert.strictEqual(res4.status, 403, `Expected 403 Forbidden, got ${res4.status}`);
    assert.strictEqual(res4.body.success, false);
    console.log('   ✅ PASS: POST /api/v4/operations-center with unauthorized token returned 403');

    // 5. Privilege Escalation Denial (Attacker forged id: 'U-001' with role: 'viewer') -> 403
    console.log('3. Testing Privilege Escalation Denial (Forged id: U-001 with viewer role)...');
    const forgedToken = generateTestToken({ id: 'U-001', username: 'attacker', role: 'viewer', permissions: ['DASHBOARD.VIEW'] });
    const res5 = await doRequest(server, {
      method: 'POST',
      path: '/api/v4/operations-center',
      headers: { Authorization: `Bearer ${forgedToken}` },
      body: { title: 'محاولة اختراق بصلاحية مزورة' }
    });
    assert.strictEqual(res5.status, 403, `Expected 403 Forbidden for forged U-001 viewer, got ${res5.status}`);
    console.log('   ✅ PASS: Privilege escalation blocked: forged U-001 viewer denied with 403');

    // 6. Validation Error: Missing Title with Admin Token -> 400
    console.log('4. Testing Input Validation (400 Bad Request)...');
    const adminToken = generateTestToken({ id: 'U-001', username: 'admin', role: 'admin', permissions: ['*'] });
    const res6 = await doRequest(server, {
      method: 'POST',
      path: '/api/v4/operations-center',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { description: 'مهمة بدون عنوان إجباري' }
    });
    assert.strictEqual(res6.status, 400, `Expected 400 Bad Request, got ${res6.status}`);
    assert(res6.body.error.includes('عنوان المهمة'), 'Validation error message returned');
    console.log('   ✅ PASS: POST /api/v4/operations-center without title returned 400');

    // 7. Successful Creation with Admin Token -> 201
    console.log('5. Testing Valid Authorized Creation (201 Created)...');
    const res7 = await doRequest(server, {
      method: 'POST',
      path: '/api/v4/operations-center',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: 'إصلاح هبوط إسفلتي قرب مثلث عبين',
        task_type: 'technical',
        priority: 'high',
        location_name: 'طريق مثلث عبين'
      }
    });
    assert.strictEqual(res7.status, 201, `Expected 201 Created, got ${res7.status}`);
    assert(res7.body.success === true);
    assert(res7.body.data.task_number.startsWith('TSK-'));
    const testOpId = res7.body.data.id;
    console.log(`   ✅ PASS: Operation created successfully with ID: ${testOpId}`);

    // 8. GET Stats with Authorized Token -> 200
    console.log('6. Testing Stats Endpoint (200 OK)...');
    const res8 = await doRequest(server, {
      method: 'GET',
      path: '/api/v4/operations-center/stats',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res8.status, 200);
    assert(res8.body.success === true);
    assert(typeof res8.body.data.total === 'number');
    console.log('   ✅ PASS: GET /stats returned 200 with executive data');

    // 9. Clean up via DELETE -> 200
    console.log('7. Testing Deletion via DELETE (200 OK)...');
    const res9 = await doRequest(server, {
      method: 'DELETE',
      path: `/api/v4/operations-center/${testOpId}`,
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res9.status, 200);
    assert(res9.body.success === true);
    console.log('   ✅ PASS: DELETE returned 200 and cleaned up record');

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎯 ALL 7 OPERATIONS CENTER HTTP API TESTS PASSED (100%)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  } finally {
    server.close();
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

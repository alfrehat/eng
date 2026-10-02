/**
 * scratch/test_budget_forensic_suite.js
 * 🧪 جناح التدقيق الجنائي والاختبارات الشاملة لمنظومة الموازنة العامة والبنود والمخصصات
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

'use strict';

const path = require('path');
module.paths.push(path.join(process.cwd(), 'node_modules'));

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:123456@localhost:5432/kafr_inja_engineering';
}

const http = require('http');
const express = require('express');
const assert = require('assert');
const { getPool, isPostgresActive, memDb } = require(path.join(process.cwd(), 'utils', 'database'));
const budgetEngineService = require(path.join(process.cwd(), 'services', 'budgetEngineService'));
const numberingEngine = require(path.join(process.cwd(), 'services', 'numberingEngine'));
const budgetApiRouter = require(path.join(process.cwd(), 'Budget', 'API', 'budgetEngine.js'));

let passedTests = 0;
let failedTests = 0;

function pass(testName) {
  passedTests++;
  console.log(`  ✅ [PASS] ${testName}`);
}

function fail(testName, error) {
  failedTests++;
  console.error(`  ❌ [FAIL] ${testName}: ${error.message || error}`);
}

async function runSuite() {
  console.log('================================================================');
  console.log('🔬 STARTING BUDGET FORENSIC AUDIT & VERIFICATION SUITE');
  console.log('================================================================');

  let tries = 0;
  while (!isPostgresActive() && tries < 20) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }
  const pool = getPool();
  console.log('[DB Status] isPostgresActive:', isPostgresActive());

  const testYear = '2026';
  const createdLineIds = [];

  // -------------------------------------------------------------
  // 1. Numbering Monotonicity & Atomic Format
  // -------------------------------------------------------------
  console.log('\n--- 1. Numbering Monotonicity & Central Sequences ---');
  try {
    const id1 = await numberingEngine.generateNextId('budget_lines', { prefix: 'BL', year: 2026 });
    const id2 = await numberingEngine.generateNextId('budget_lines', { prefix: 'BL', year: 2026 });
    assert.match(id1, /^BL-2026-\d{4}$/, 'Line ID must follow BL-YYYY-XXXX format');
    assert.match(id2, /^BL-2026-\d{4}$/, 'Line ID must follow BL-YYYY-XXXX format');
    const num1 = parseInt(id1.split('-')[2], 10);
    const num2 = parseInt(id2.split('-')[2], 10);
    assert.strictEqual(num2, num1 + 1, 'Sequence must increment monotonically');
    pass('Budget line IDs follow BL-YYYY-XXXX format and increment monotonically');

    const alcId1 = await numberingEngine.generateNextId('budget_allocations', { prefix: 'ALC', year: 2026 });
    assert.match(alcId1, /^ALC-2026-\d{4}$/, 'Allocation ID must follow ALC-YYYY-XXXX format');
    pass('Allocation IDs follow ALC-YYYY-XXXX format');
  } catch (e) {
    fail('Numbering generation', e);
  }

  // -------------------------------------------------------------
  // 2. Budget Line Lifecycle: Create, Read, Update, Delete
  // -------------------------------------------------------------
  console.log('\n--- 2. Budget Line Lifecycle ---');
  let lineA = null;
  try {
    lineA = await budgetEngineService.createBudgetLine({
      line_name: 'بند صيانة وتعبيد شوارع كفرنجة الرأسمالية',
      chapter_code: '211',
      chapter_name: 'نفقات المشاريع الهندسية الرأسمالية',
      allocated_amount: 150000.00,
      year: testYear,
      funding_source: 'موازنة البلدية الذاتية',
      department: 'مديرية الأشغال والخدمات الهندسية'
    }, { id: 'U-TEST-01' });

    assert.ok(lineA, 'Line A must be created');
    assert.match(lineA.id, /^BL-2026-\d{4}$/, 'Line ID must be atomic');
    assert.strictEqual(parseFloat(lineA.allocated_amount), 150000);
    createdLineIds.push(lineA.id);
    pass('Budget Line created with valid atomic ID and stored in database');

    const fetched = await budgetEngineService.getBudgetLineById(lineA.id);
    assert.ok(fetched, 'Line must be fetchable by ID');
    assert.strictEqual(fetched.id, lineA.id);
    assert.strictEqual(parseFloat(fetched.allocated_amount), 150000);
    assert.strictEqual(parseFloat(fetched.available_commitment), 150000);
    assert.strictEqual(parseFloat(fetched.remaining_amount), 150000);
    pass('getBudgetLineById returns created record with correct initial metrics');

    // Update
    const updated = await budgetEngineService.updateBudgetLine(lineA.id, {
      allocated_amount: 180000.00,
      notes: 'توسيع المخصص بموجب قرار المجلس البلدي'
    }, { id: 'U-TEST-01' });

    assert.strictEqual(parseFloat(updated.allocated_amount), 180000);
    assert.strictEqual(parseFloat(updated.available_commitment), 180000);
    pass('updateBudgetLine updates allocated_amount and recalculates metrics');
  } catch (e) {
    fail('Budget line lifecycle', e);
  }

  // -------------------------------------------------------------
  // 3. Validation and Input Integrity
  // -------------------------------------------------------------
  console.log('\n--- 3. Validation & Strict Input Semantics ---');
  try {
    let errCaught = false;
    try {
      await budgetEngineService.createBudgetLine({ line_name: '', allocated_amount: 1000 });
    } catch (e) {
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'Empty line name must be rejected');
    pass('Empty line name rejected with validation error');

    errCaught = false;
    try {
      await budgetEngineService.createBudgetLine({ line_name: 'بند خاطئ', allocated_amount: -500 });
    } catch (e) {
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'Negative allocated_amount must be rejected');
    pass('Negative allocated_amount rejected with validation error');

    errCaught = false;
    try {
      await budgetEngineService.createBudgetLine({ line_name: 'بند NaN', allocated_amount: 'invalid_num' });
    } catch (e) {
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'NaN allocated_amount must be rejected');
    pass('NaN allocated_amount rejected with validation error');
  } catch (e) {
    fail('Input validation', e);
  }

  // -------------------------------------------------------------
  // 4. Financial Calculations: Commitments, Ceiling Lock & Disbursement
  // -------------------------------------------------------------
  console.log('\n--- 4. Financial Allocations, Ceiling Enforcement & Disbursement ---');
  try {
    // 1st allocation: 60,000 JD
    const alloc1 = await budgetEngineService.createAllocation({
      budget_line_id: lineA.id,
      entity_type: 'TENDER',
      entity_id: 'T-2026-TEST-01',
      entity_name: 'عطاء خلطات إسفلتية ساخنة',
      amount: 60000.00,
      status: 'COMMITTED'
    }, { id: 'U-TEST-01' });

    assert.ok(alloc1 && alloc1.success, 'Allocation 1 must succeed');
    assert.match(alloc1.allocationId, /^ALC-2026-\d{4}$/, 'Allocation ID must be atomic');
    pass('Allocation 1 (60,000 JD) created with atomic ID');

    // Verify metrics after 1st allocation
    let metrics = await budgetEngineService.calculateLineMetrics(lineA.id, 180000);
    assert.strictEqual(metrics.committed, 60000);
    assert.strictEqual(metrics.spent, 0);
    assert.strictEqual(metrics.available_commitment, 120000);
    assert.strictEqual(metrics.remaining_amount, 180000);
    pass('Line metrics after 1st commitment: committed=60k, available=120k, remaining=180k');

    // 2nd allocation: 100,000 JD
    const alloc2 = await budgetEngineService.createAllocation({
      budget_line_id: lineA.id,
      entity_type: 'PURCHASE',
      entity_id: 'PUR-2026-TEST-01',
      entity_name: 'أمر شراء حجر جيري ومواد بيس كورس',
      amount: 100000.00,
      status: 'COMMITTED'
    }, { id: 'U-TEST-01' });

    assert.ok(alloc2 && alloc2.success);
    metrics = await budgetEngineService.calculateLineMetrics(lineA.id, 180000);
    assert.strictEqual(metrics.committed, 160000);
    assert.strictEqual(metrics.available_commitment, 20000);
    pass('Line metrics after 2nd commitment: committed=160k, available=20k');

    // 3rd allocation: attempt 30,000 JD when only 20,000 JD is available (Ceiling breach)
    let ceilingError = false;
    try {
      await budgetEngineService.createAllocation({
        budget_line_id: lineA.id,
        entity_type: 'TENDER',
        entity_id: 'T-2026-TEST-OVER',
        amount: 30000.00
      }, { id: 'U-TEST-01' });
    } catch (e) {
      ceilingError = true;
      assert.ok(e.message.includes('مخصص غير كافٍ'), 'Error message must state insufficient allocation');
    }
    assert.strictEqual(ceilingError, true, 'Ceiling breach must be blocked atomically');
    pass('Ceiling enforcement successfully blocked over-allocation (atomic rollback)');

    // Disburse allocation 1 (Disbursement: convert committed to spent)
    const disburseRes = await budgetEngineService.disburseAllocation({
      entity_type: 'TENDER',
      entity_id: 'T-2026-TEST-01'
    }, { id: 'U-TEST-01' });
    assert.ok(disburseRes.success);

    metrics = await budgetEngineService.calculateLineMetrics(lineA.id, 180000);
    assert.strictEqual(metrics.committed, 160000);
    assert.strictEqual(metrics.spent, 60000);
    assert.strictEqual(metrics.remaining_amount, 120000);
    assert.strictEqual(metrics.available_commitment, 20000);
    pass('Disbursement updates spent amount (spent=60k, remaining_amount=120k)');

    // Release allocation 2 (Cancelled purchase: release commitment)
    const releaseRes = await budgetEngineService.releaseAllocation({
      entity_type: 'PURCHASE',
      entity_id: 'PUR-2026-TEST-01'
    }, { id: 'U-TEST-01' });
    assert.ok(releaseRes.success);

    metrics = await budgetEngineService.calculateLineMetrics(lineA.id, 180000);
    assert.strictEqual(metrics.committed, 60000);
    assert.strictEqual(metrics.spent, 60000);
    assert.strictEqual(metrics.available_commitment, 120000);
    pass('Release allocation restores available commitment capacity to 120,000 JD');
  } catch (e) {
    fail('Allocations and financial calculations', e);
  }

  // -------------------------------------------------------------
  // 5. Fiscal Year Isolation & Summary Totals
  // -------------------------------------------------------------
  console.log('\n--- 5. Fiscal Year Isolation & Budget Summary Totals ---');
  let line2027 = null;
  try {
    line2027 = await budgetEngineService.createBudgetLine({
      line_name: 'بند موازنة العام القادم 2027',
      allocated_amount: 250000.00,
      year: '2027',
      chapter_code: '212',
      chapter_name: 'مشاريع البنية التحتية 2027'
    }, { id: 'U-TEST-01' });
    createdLineIds.push(line2027.id);

    const lines2026 = await budgetEngineService.getBudgetLines({ year: '2026' });
    const lines2027 = await budgetEngineService.getBudgetLines({ year: '2027' });

    assert.ok(lines2026.every(l => String(l.year) === '2026'), '2026 filter must only return 2026 lines');
    assert.ok(lines2027.every(l => String(l.year) === '2027'), '2027 filter must only return 2027 lines');
    assert.ok(lines2026.some(l => l.id === lineA.id), 'Line A must be in 2026');
    assert.ok(lines2027.some(l => l.id === line2027.id), 'Line 2027 must be in 2027');
    pass('Fiscal year filtering strictly isolates years without cross-contamination');

    // Summary calculation
    const summary2026 = await budgetEngineService.getBudgetSummary('2026');
    assert.ok(summary2026.totalAllocated >= 180000);
    assert.strictEqual(summary2026.year, '2026');
    assert.strictEqual(summary2026.uncommittedBalance, summary2026.totalAllocated - summary2026.totalCommitted);
    assert.strictEqual(summary2026.unspentBalance, summary2026.totalAllocated - summary2026.totalSpent);
    pass('getBudgetSummary calculates totalAllocated, totalCommitted, totalSpent accurately');
  } catch (e) {
    fail('Fiscal year isolation', e);
  }

  // -------------------------------------------------------------
  // 6. PostgreSQL Failure Semantics & Zero False Success
  // -------------------------------------------------------------
  console.log('\n--- 6. PostgreSQL Failure Semantics & Atomicity (Zero False Success) ---');
  try {
    const originalQuery = pool.query;
    let failureTriggered = false;

    // Simulate DB failure on insert
    pool.query = async function (text, params) {
      if (typeof text === 'string' && text.includes('INSERT INTO public.directorate_budget_lines')) {
        failureTriggered = true;
        throw new Error('SIMULATED_POSTGRES_WRITE_FAILURE');
      }
      return originalQuery.apply(this, arguments);
    };

    let writeErrorCaught = false;
    const initialMemCount = (memDb.directorate_budget_lines || []).length;

    try {
      await budgetEngineService.createBudgetLine({
        line_name: 'بند تجربة فشل قاعدة البيانات',
        allocated_amount: 50000,
        year: '2026'
      });
    } catch (err) {
      writeErrorCaught = true;
      assert.ok(err.message.includes('DATABASE_WRITE_FAILED'), 'Error must explicitly state DATABASE_WRITE_FAILED');
    } finally {
      pool.query = originalQuery;
    }

    assert.strictEqual(failureTriggered, true, 'Failure simulation must have fired');
    assert.strictEqual(writeErrorCaught, true, 'Database write failure must throw explicit error');
    assert.strictEqual((memDb.directorate_budget_lines || []).length, initialMemCount, 'memDb must NOT be modified when DB fails');
    pass('Database write failure throws DATABASE_WRITE_FAILED and leaves memDb completely untouched');

    // Simulate DB read failure
    pool.query = async function (text, params) {
      if (typeof text === 'string' && text.includes('SELECT * FROM public.directorate_budget_lines')) {
        throw new Error('SIMULATED_POSTGRES_READ_FAILURE');
      }
      return originalQuery.apply(this, arguments);
    };

    let readErrorCaught = false;
    try {
      await budgetEngineService.getBudgetLines({ year: '2026' });
    } catch (err) {
      readErrorCaught = true;
      assert.ok(err.message.includes('DATABASE_READ_FAILED'), 'Read error must state DATABASE_READ_FAILED');
    } finally {
      pool.query = originalQuery;
    }

    assert.strictEqual(readErrorCaught, true, 'PostgreSQL read failure must NOT degrade to [] or memDb');
    pass('PostgreSQL read failure throws DATABASE_READ_FAILED without silent fallback');
  } catch (e) {
    fail('PostgreSQL failure semantics', e);
  }

  // -------------------------------------------------------------
  // 7. HealthCheck Diagnostics (Zero False Health)
  // -------------------------------------------------------------
  console.log('\n--- 7. HealthCheck Diagnostics ---');
  try {
    const health = await budgetEngineService.healthCheck();
    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.status, 'READY');
    assert.ok(health.totalBudgetLines >= 1);
    pass('healthCheck reports healthy: true when PostgreSQL is operational');

    // Simulate DB error during health check
    const originalQuery = pool.query;
    pool.query = async function (text, params) {
      if (typeof text === 'string' && text.includes('COUNT(*)')) {
        throw new Error('SIMULATED_HEALTH_DB_DOWN');
      }
      return originalQuery.apply(this, arguments);
    };

    const degradedHealth = await budgetEngineService.healthCheck();
    pool.query = originalQuery;

    assert.strictEqual(degradedHealth.healthy, false);
    assert.strictEqual(degradedHealth.status, 'DEGRADED');
    pass('healthCheck reports healthy: false, status: DEGRADED on database failure (Zero false health)');
  } catch (e) {
    fail('HealthCheck diagnostics', e);
  }

  // -------------------------------------------------------------
  // 9. HTTP API Adapter & RBAC Authorization Enforcement
  // -------------------------------------------------------------
  console.log('\n--- 9. HTTP API Adapter & Authorization Enforcement ---');
  try {
    const app = express();
    app.use(express.json());
    // Attach router
    app.use('/api/budget', budgetApiRouter);

    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(method, urlPath, headers = {}, body = null) {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${baseUrl}${urlPath}`, opts);
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    }

    // 1. Unauthenticated request to /lines -> 401
    const unauthRes = await req('GET', '/api/budget/lines');
    assert.strictEqual(unauthRes.status, 401);
    pass('Unauthenticated request rejected with 401 Unauthorized');

    // 2. Mock auth middleware for authorization checks
    const appAuth = express();
    appAuth.use(express.json());
    appAuth.use((req, res, next) => {
      const authRole = req.headers['x-test-role'];
      if (authRole === 'no-perm') {
        req.user = { id: 'U-NO-PERM', role: 'engineer', permissions: ['SOME_OTHER_PERM'] };
      } else if (authRole === 'authorized') {
        req.user = { id: 'U-BUDGET-ADMIN', role: 'admin', permissions: ['*'] };
      }
      next();
    });
    appAuth.use('/api/budget', budgetApiRouter);

    const serverAuth = http.createServer(appAuth);
    await new Promise(r => serverAuth.listen(0, r));
    const portAuth = serverAuth.address().port;
    const authUrl = `http://127.0.0.1:${portAuth}`;

    async function reqAuth(method, urlPath, role, body = null) {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'x-test-role': role }
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${authUrl}${urlPath}`, opts);
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    }

    // Unauthorized creation -> 403
    const forbidRes = await reqAuth('POST', '/api/budget/lines', 'no-perm', { line_name: 'test', allocated_amount: 1000 });
    assert.strictEqual(forbidRes.status, 403);
    pass('Unauthorized request rejected with 403 Forbidden');

    // Authorized GET /summary -> 200
    const summaryRes = await reqAuth('GET', '/api/budget/summary?year=2026', 'authorized');
    assert.strictEqual(summaryRes.status, 200);
    assert.strictEqual(summaryRes.data.success, true);
    assert.ok(summaryRes.data.data.year === '2026');
    pass('GET /api/budget/summary succeeds with 200 and matches response contract');

    // Authorized GET /lines -> 200
    const linesRes = await reqAuth('GET', '/api/budget/lines?year=2026', 'authorized');
    assert.strictEqual(linesRes.status, 200);
    assert.strictEqual(linesRes.data.success, true);
    assert.ok(Array.isArray(linesRes.data.data));
    pass('GET /api/budget/lines succeeds with 200 and returns array of lines');

    // Authorized POST /lines -> 201
    const createRes = await reqAuth('POST', '/api/budget/lines', 'authorized', {
      line_name: 'بند تجربة واجهة برمجة التطبيقات',
      allocated_amount: 80000.00,
      year: '2026',
      chapter_code: '211',
      chapter_name: 'نفقات المشاريع الرأسمالية'
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.data.success, true);
    assert.match(createRes.data.data.id, /^BL-2026-\d{4}$/);
    pass('POST /api/budget/lines creates budget line and returns 201 Created');

    const createdApiId = createRes.data.data.id;

    // Authorized PUT /lines/:id -> 200
    const updateRes = await reqAuth('PUT', `/api/budget/lines/${createdApiId}`, 'authorized', {
      allocated_amount: 90000.00
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(parseFloat(updateRes.data.data.allocated_amount), 90000);
    pass('PUT /api/budget/lines/:id updates budget line and returns 200 OK');

    // Authorized DELETE /lines/:id -> 200
    const deleteRes = await reqAuth('DELETE', `/api/budget/lines/${createdApiId}`, 'authorized');
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.data.success, true);
    pass('DELETE /api/budget/lines/:id deletes budget line and returns 200 OK');

    server.close();
    serverAuth.close();
  } catch (e) {
    fail('HTTP API Adapter & RBAC Authorization', e);
  }

  // -------------------------------------------------------------
  // 10. Delete Test Budget Lines & Cascading Allocations Cleanup
  // -------------------------------------------------------------
  console.log('\n--- 10. Delete & Cascade Cleanup ---');
  try {
    for (const id of createdLineIds) {
      const delRes = await budgetEngineService.deleteBudgetLine(id, { id: 'U-TEST-01' });
      assert.strictEqual(delRes.success, true);
    }
    pass('Created test budget lines deleted cleanly');

    const linesAfter = await budgetEngineService.getBudgetLines({ year: '2027' });
    assert.strictEqual(linesAfter.some(l => l.id === line2027.id), false);
    pass('Deleted lines confirmed removed from database and memory');
  } catch (e) {
    fail('Delete budget line', e);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 BUDGET FORENSIC SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch(err => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});

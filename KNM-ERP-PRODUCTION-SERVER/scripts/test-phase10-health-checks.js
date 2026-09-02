/**
 * scripts/test-phase10-health-checks.js
 * 🏥 فحص نقاط الفحص الصحي والجاهزية (Phase 10 Health & Readiness Endpoints)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3110;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
  });
}

async function waitForServer(maxAttempts = 25, interval = 300) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await makeRequest('/health');
      if (res.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

async function runPhase10HealthChecksTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏥 بدء فحص نقاط التحقق الصحي والجاهزية (Phase 10 Health & Readiness)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
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
    // 1. GET /health
    const healthRes = await makeRequest('/health');
    assert(healthRes.status === 200 && healthRes.data?.status === 'healthy', 'General health endpoint (/health) operational');

    // 2. GET /ready
    const readyRes = await makeRequest('/ready');
    assert(readyRes.status === 200 && readyRes.data?.ready === true, 'Readiness endpoint (/ready) operational');

    // 3. GET /health/database
    const dbHealthRes = await makeRequest('/health/database');
    assert(dbHealthRes.status === 200 && dbHealthRes.data?.status === 'healthy', 'Database health endpoint (/health/database) operational');

    // 4. GET /health/engines
    const enginesHealthRes = await makeRequest('/health/engines');
    assert(enginesHealthRes.status === 200 && enginesHealthRes.data?.allReady === true, 'Engines health endpoint (/health/engines) operational');
  } catch (err) {
    assert(false, 'Health checks suite failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لنقاط الفحص الصحي: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

async function startSuite() {
  const serverProc = spawn('node', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(TEST_PORT), HOST: '127.0.0.1' })
  });
  serverProc.stdout.on('data', () => {});
  serverProc.stderr.on('data', () => {});

  try {
    const ready = await waitForServer();
    if (!ready) throw new Error('Server failed to start on test port ' + TEST_PORT);
    return await runPhase10HealthChecksTestSuite();
  } finally {
    serverProc.kill();
  }
}

if (require.main === module) {
  startSuite().then(res => process.exit(res.failed > 0 ? 1 : 0)).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = startSuite;

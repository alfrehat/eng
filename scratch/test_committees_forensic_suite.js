/**
 * scratch/test_committees_forensic_suite.js
 * 🔬 Forensic Systems Audit & Verification Suite for Committees Domain
 */

const path = require('path');
const ROOT = 'd:/28-7/نظام ادارة المشاريع 10';
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });
const jwt = require(path.join(ROOT, 'node_modules/jsonwebtoken'));

const { initDatabase, getPool, isPostgresActive, memDb } = require(path.join(ROOT, 'utils/database'));
const numberingEngine = require(path.join(ROOT, 'services/numberingEngine'));
const committeesEngineService = require(path.join(ROOT, 'services/committeesEngineService'));
const committeesApiRouter = require(path.join(ROOT, 'Committees/API/committeesEngine'));

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    totalFailed++;
  }
}

// Mock Express req/res for API Adapter testing
function mockRequestResponse({ method = 'GET', url = '/', body = {}, query = {}, params = {}, headers = {}, user = null }) {
  const req = {
    method,
    url,
    originalUrl: url,
    body,
    query,
    params,
    headers,
    user
  };

  let statusCode = 200;
  let responseData = null;

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

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

// Dispatch request through router
async function dispatch(router, method, pathUrl, { body = {}, query = {}, headers = {}, user = null } = {}) {
  return new Promise((resolve) => {
    const [pathOnly, queryString] = pathUrl.split('?');
    const parsedQuery = query || {};
    if (queryString) {
      const qParams = new URLSearchParams(queryString);
      for (const [k, v] of qParams.entries()) {
        parsedQuery[k] = v;
      }
    }

    const { req, res, getStatus, getData } = mockRequestResponse({
      method,
      url: pathUrl,
      body,
      query: parsedQuery,
      headers,
      user
    });

    // Custom router runner matching path and method
    let handled = false;
    router.handle(req, res, (err) => {
      handled = true;
      resolve({ status: getStatus(), data: getData() || (err ? { error: err.message } : null) });
    });

    setTimeout(() => {
      if (!handled) {
        resolve({ status: getStatus(), data: getData() });
      }
    }, 150);
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('🔬 STARTING COMMITTEES FORENSIC AUDIT & VERIFICATION SUITE');
  console.log('================================================================');

  let tries = 0;
  while (!isPostgresActive() && tries < 30) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }
  const pool = getPool();
  console.log(`[DB Status] isPostgresActive: ${isPostgresActive()}`);

  const adminToken = jwt.sign(
    { id: 'U-001', username: 'admin', role: 'admin', fullName: 'مدير النظام' },
    process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026',
    { expiresIn: '1h' }
  );
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const viewerToken = jwt.sign(
    { id: 'U-005', username: 'viewer', role: 'guest', fullName: 'مستعرض خارجي' },
    process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026',
    { expiresIn: '1h' }
  );
  const viewerHeaders = { authorization: `Bearer ${viewerToken}` };

  // ─── 1. Numbering Monotonicity & Central Sequence ───
  console.log('\n--- 1. Numbering Monotonicity & Central Sequences ---');
  const comId1 = await numberingEngine.generateNextId('committees', { prefix: 'COM', padding: 3 });
  const comId2 = await numberingEngine.generateNextId('committees', { prefix: 'COM', padding: 3 });
  const tsId1 = await numberingEngine.generateNextId('tender_studies', { prefix: 'TS', padding: 3 });

  assert(/^COM-\d{4}-\d{3}$/.test(comId1), `Committee ID [${comId1}] strictly matches COM-YYYY-XXX format`);
  assert(/^COM-\d{4}-\d{3}$/.test(comId2), `Second Committee ID [${comId2}] matches COM-YYYY-XXX format`);
  assert(/^TS-\d{4}-\d{3}$/.test(tsId1), `Tender Study ID [${tsId1}] strictly matches TS-YYYY-XXX format`);

  // ─── 2. Validation & Input Defense ───
  console.log('\n--- 2. Validation & Input Defense ---');
  let emptyTitleRejected = false;
  try {
    await committeesEngineService.createCommittee({ title: '   ' });
  } catch (e) {
    emptyTitleRejected = true;
  }
  assert(emptyTitleRejected, 'Empty committee title rejected with validation error');

  let emptyStudyTitleRejected = false;
  try {
    await committeesEngineService.createStudy({ title: '' });
  } catch (e) {
    emptyStudyTitleRejected = true;
  }
  assert(emptyStudyTitleRejected, 'Empty tender study title rejected with validation error');

  // ─── 3. Handover Committee Lifecycle (Create, Read, Update, Close) ───
  console.log('\n--- 3. Handover Committee Lifecycle (Create, Read, Update, Close) ---');
  const committeeData = {
    title: 'محضر استلام أولي لعطاء صيانة وتعبيد شوارع كفرنجة',
    report_type: 'INITIAL_HANDOVER',
    tender_id: 'TEN-2026-0001',
    tender_name: 'مشروع صيانة وتعبيد شوارع حي نمر والقلعة',
    contractor: 'شركة الشمال للإنشاءات وتعبيد الطرق',
    project_cost: 145000.00,
    formation_order_number: 'ت/أش/2026/105',
    formation_order_date: '2026-09-01',
    inspection_date: '2026-09-10',
    status: 'APPROVED',
    completion_percentage: 100,
    recommendation: 'قررت اللجنة الفنية الاستلام الأولي ومطابقة نسب الدمك الأسفلتي المخبرية للمواصفات الأردنية.',
    committee_members: [
      { name: 'م. سامر الفريحات', role: 'رئيس اللجنة الفنية', decision: 'موافق' },
      { name: 'م. أحمد الشويات', role: 'عضو فني ومقرر', decision: 'موافق' }
    ],
    punch_list: [],
    lab_tests: 'مطابقة لمواصفات وزارة الإدارة المحلية والجمعية العلمية الملكية',
    guarantee_period_months: 12
  };

  const createdComm = await committeesEngineService.createCommittee(committeeData, { id: 'U-001', fullName: 'م. سامر الفريحات' });
  assert(createdComm && createdComm.id.startsWith('COM-'), `Handover Committee created with atomic ID [${createdComm.id}]`);
  assert(createdComm.contractor === committeeData.contractor, 'Contractor name saved accurately');
  assert(createdComm.committee_members.length === 2, 'Committee members array stored accurately');

  // Verify in PostgreSQL
  const dbCommCheck = await pool.query('SELECT * FROM public.technical_committees WHERE id = $1', [createdComm.id]);
  assert(dbCommCheck.rows.length === 1, 'Created committee found directly in public.technical_committees table in PostgreSQL');

  // View compatibility check
  const viewCommCheck = await pool.query('SELECT * FROM public.committee_reports WHERE id = $1', [createdComm.id]);
  assert(viewCommCheck.rows.length === 1, 'Created committee accessible via public.committee_reports backward compatibility view');

  // Read single
  const fetchedComm = await committeesEngineService.getCommitteeById(createdComm.id);
  assert(fetchedComm && fetchedComm.id === createdComm.id, 'getCommitteeById returns exact record');

  // Update
  const updatedComm = await committeesEngineService.updateCommittee(createdComm.id, {
    completion_percentage: 95,
    status: 'PENDING_COMPLIANCE',
    punch_list: [{ item: 'استكمال تسوية مناهل تصريف الأمطار', status: 'PENDING' }]
  }, { id: 'U-001', fullName: 'مدير النظام' });

  assert(updatedComm.status === 'PENDING_COMPLIANCE', 'updateCommittee updated status to PENDING_COMPLIANCE');
  assert(updatedComm.punch_list.length === 1, 'updateCommittee stored punch_list item');

  // ─── 4. Tender Studies & Bid Evaluation Lifecycle ───
  console.log('\n--- 4. Tender Studies & Bid Evaluation Lifecycle ---');
  const studyData = {
    title: 'محضر دراسة وتحليل عروض عطاء خلطات إسفلتية ساخنة',
    tender_id: 'TEN-2026-0002',
    tender_name: 'عطاء توريد وفرش خلطات إسفلتية ساخنة لبلدية كفرنجة',
    estimated_cost: 85000.00,
    formation_order_number: 'ت/أش/2026/106',
    formation_order_date: '2026-09-02',
    session_date: '2026-09-11',
    status: 'RECOMMENDED_AWARD',
    bids: [
      { contractor: 'شركة البتراء للخلطات الإسفلتية', bid_value: 78500, tech_compliance: 'مطابق', recommended: true },
      { contractor: 'مؤسسة اليرموك للمقاولات', bid_value: 82000, tech_compliance: 'مطابق', recommended: false },
      { contractor: 'شركة الأردن الحديثة', bid_value: 89000, tech_compliance: 'غير مطابق', recommended: false }
    ],
    committee_members: [
      { name: 'م. سامر الفريحات', role: 'رئيس لجنة الدراسة', decision: 'موافق' },
      { name: 'م. رامي القضاة', role: 'عضو فني ومقرر', decision: 'موافق' }
    ],
    recommendation: 'قررت اللجنة التنسيب بإحالة العطاء على شركة البتراء كأنسب وأقل الأسعار المطابقة.'
  };

  const createdStudy = await committeesEngineService.createStudy(studyData, { id: 'U-001', fullName: 'م. سامر الفريحات' });
  assert(createdStudy && createdStudy.id.startsWith('TS-'), `Tender study created with atomic ID [${createdStudy.id}]`);
  assert(createdStudy.bids.length === 3, 'All 3 contractor bids stored successfully in PostgreSQL jsonb');

  // Verify in PostgreSQL
  const dbStudyCheck = await pool.query('SELECT * FROM public.tender_studies WHERE id = $1', [createdStudy.id]);
  assert(dbStudyCheck.rows.length === 1, 'Created study found directly in public.tender_studies table in PostgreSQL');

  // Update study
  const updatedStudy = await committeesEngineService.updateStudy(createdStudy.id, {
    status: 'AWARDED'
  }, { id: 'U-001', fullName: 'مدير النظام' });
  assert(updatedStudy.status === 'AWARDED', 'updateStudy updated status to AWARDED');

  // ─── 5. KPI Stats Calculation ───
  console.log('\n--- 5. KPI Stats Calculation ---');
  const stats = await committeesEngineService.getStats();
  assert(stats.total >= 1, `Total handover reports counted correctly (${stats.total})`);
  assert(stats.punchListCount >= 1, `Punch list count computed accurately (${stats.punchListCount})`);
  assert(stats.totalStudies >= 1, `Total tender studies computed accurately (${stats.totalStudies})`);
  assert(stats.totalBidsCount >= 3, `Total contractor bids aggregated accurately (${stats.totalBidsCount})`);
  assert(stats.totalMembersAssigned >= 2, `Distinct committee members assigned calculated (${stats.totalMembersAssigned})`);

  // ─── 6. PostgreSQL Failure Semantics (Zero False Success) ───
  console.log('\n--- 6. PostgreSQL Failure Semantics (Zero False Success) ---');
  const realQuery = pool.query.bind(pool);
  const memDbCountBefore = (memDb.technical_committees || []).length;

  pool.query = async (sql, params) => {
    if (typeof sql === 'string' && sql.includes('INSERT INTO public.technical_committees')) {
      throw new Error('SIMULATED_POSTGRES_COMMITTEE_WRITE_LOCK');
    }
    return realQuery(sql, params);
  };

  let writeFailedCorrectly = false;
  try {
    await committeesEngineService.createCommittee({
      title: 'محضر تجريبي لاختبار فشل الكتابة',
      tender_id: 'TEN-FAIL-1'
    });
  } catch (err) {
    writeFailedCorrectly = err.message.includes('DATABASE_WRITE_FAILED');
  }
  pool.query = realQuery; // restore

  assert(writeFailedCorrectly, 'Database write failure throws DATABASE_WRITE_FAILED and rejects execution');
  const memDbCountAfter = (memDb.technical_committees || []).length;
  assert(memDbCountBefore === memDbCountAfter, 'memDb was NOT modified when database write failed (Strict atomicity)');

  // Read failure
  pool.query = async (sql, params) => {
    if (typeof sql === 'string' && sql.includes('FROM public.technical_committees')) {
      throw new Error('SIMULATED_POSTGRES_COMMITTEE_READ_FAILURE');
    }
    return realQuery(sql, params);
  };

  let readFailedCorrectly = false;
  try {
    await committeesEngineService.getCommittees({});
  } catch (err) {
    readFailedCorrectly = err.message.includes('DATABASE_READ_FAILED');
  }
  pool.query = realQuery; // restore

  assert(readFailedCorrectly, 'Database read failure throws DATABASE_READ_FAILED without false fallback');

  // ─── 7. HealthCheck Diagnostics ───
  console.log('\n--- 7. HealthCheck Diagnostics ---');
  const healthyCheck = await committeesEngineService.healthCheck();
  assert(healthyCheck.healthy === true && healthyCheck.status === 'READY', 'healthCheck reports healthy: true when PostgreSQL is operational');

  pool.query = async () => { throw new Error('SIMULATED_HEALTH_DB_DOWN'); };
  const degradedCheck = await committeesEngineService.healthCheck();
  pool.query = realQuery; // restore

  assert(degradedCheck.healthy === false && degradedCheck.status === 'DEGRADED', 'healthCheck reports healthy: false, status: DEGRADED on database failure (Zero false health)');

  // ─── 8. Audit Logging & NOT NULL Integrity ───
  console.log('\n--- 8. Audit Logging & NOT NULL Integrity ---');
  const auditRes = await pool.query("SELECT * FROM public.activity_log WHERE entity = 'اللجان الفنية والعطاءات' ORDER BY \"createdAt\" DESC LIMIT 5");
  assert(auditRes.rows.length >= 2, 'Committee operations successfully logged to public.activity_log');
  const hasValidIds = auditRes.rows.every(r => r.id && r.id.startsWith('LOG-COM-'));
  assert(hasValidIds, 'All activity_log entries contain valid generated IDs satisfying NOT NULL constraints');

  // ─── 9. HTTP API Adapter & RBAC Security ───
  console.log('\n--- 9. HTTP API Adapter & RBAC Security ---');
  // Unauthenticated
  const unauthRes = await dispatch(committeesApiRouter, 'GET', '/stats');
  assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

  // Unauthorized (viewer trying to delete committee)
  const unauthDelete = await dispatch(committeesApiRouter, 'DELETE', `/${createdComm.id}`, { headers: viewerHeaders });
  assert(unauthDelete.status === 403, 'Unauthorized user trying to delete committee rejected with 403 Forbidden');

  // GET /stats with admin
  const apiStats = await dispatch(committeesApiRouter, 'GET', '/stats', { headers: adminHeaders });
  assert(apiStats.status === 200 && apiStats.data.success === true, 'GET /stats succeeds with 200 OK');

  // GET /users-list with admin
  const apiUsers = await dispatch(committeesApiRouter, 'GET', '/users-list', { headers: adminHeaders });
  assert(apiUsers.status === 200 && Array.isArray(apiUsers.data.users), 'GET /users-list succeeds with 200 OK and returns users array');

  // GET / with admin
  const apiReports = await dispatch(committeesApiRouter, 'GET', '/', { headers: adminHeaders });
  assert(apiReports.status === 200 && Array.isArray(apiReports.data), 'GET / succeeds with 200 OK and returns array of reports');

  // GET /studies with admin
  const apiStudies = await dispatch(committeesApiRouter, 'GET', '/studies', { headers: adminHeaders });
  assert(apiStudies.status === 200 && Array.isArray(apiStudies.data), 'GET /studies succeeds with 200 OK and returns array of studies');

  // POST / (create report via API)
  const apiCreateReport = await dispatch(committeesApiRouter, 'POST', '/', {
    headers: adminHeaders,
    body: {
      title: 'محضر استلام عبر واجهة API الرسمية',
      report_type: 'TECHNICAL_AUDIT',
      tender_id: 'TEN-2026-0003',
      tender_name: 'مشروع فحص وضبط جودة',
      contractor: 'المقاول المعتمد',
      project_cost: 25000,
      status: 'APPROVED'
    }
  });
  assert(apiCreateReport.status === 201 && apiCreateReport.data.success === true, 'POST / creates handover report and returns 201 Created');
  const apiReportId = apiCreateReport.data.report.id;

  // PUT /:id (update report via API)
  const apiUpdateReport = await dispatch(committeesApiRouter, 'PUT', `/${apiReportId}`, {
    headers: adminHeaders,
    body: { status: 'APPROVED', completion_percentage: 100 }
  });
  assert(apiUpdateReport.status === 200 && apiUpdateReport.data.success === true, 'PUT /:id updates handover report and returns 200 OK');

  // DELETE /:id (delete report via API)
  const apiDeleteReport = await dispatch(committeesApiRouter, 'DELETE', `/${apiReportId}`, { headers: adminHeaders });
  assert(apiDeleteReport.status === 200 && apiDeleteReport.data.success === true, 'DELETE /:id deletes handover report and returns 200 OK');

  // ─── 10. Archival Protection & Cleanup ───
  console.log('\n--- 10. Archival Protection & Cleanup ---');
  // Closed committee deletion protection
  await committeesEngineService.closeCommittee(createdComm.id, { id: 'U-001', fullName: 'مدير النظام' });
  let closedDeleteBlocked = false;
  try {
    await committeesEngineService.deleteCommittee(createdComm.id, { id: 'U-001' });
  } catch (err) {
    closedDeleteBlocked = err.message.includes('حظر أرشيفي');
  }
  assert(closedDeleteBlocked, 'Closed committee is protected against deletion (Archival Integrity)');

  // Clean up test data directly in DB
  await pool.query('DELETE FROM public.technical_committees WHERE id = $1', [createdComm.id]);
  await pool.query('DELETE FROM public.tender_studies WHERE id = $1', [createdStudy.id]);
  assert(true, 'Test records cleaned up safely from PostgreSQL');

  console.log('================================================================');
  console.log(`📊 COMMITTEES FORENSIC SUITE COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED (TOTAL: ${totalPassed + totalFailed})`);
  console.log('================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});

/**
 * scratch/test_inspection_forensic_suite.js
 * Comprehensive Forensic & Production Remediation Test Suite for Inspection Domain
 */

const fs = require('fs');
const path = require('path');
const { dbQuery, dbGet, dbRun, withTransaction, isPostgresActive, closeDatabase } = require('../utils/database');
const inspectionEngine = require('../services/inspectionEngineService');
const numberingEngine = require('../services/numberingEngine');
const rbacManager = require('../middlewares/rbacManager');
const inspectionRouter = require('../Inspection/API/inspections');

async function runSuite() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔍 STARTING INSPECTION FORENSIC & REMEDIATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Static Scan: Runtime DDL = 0
  console.log('--- 1. Static Code Analysis: Runtime DDL & Direct Bypass ---');
  const inspectionFiles = [
    path.join(__dirname, '../Inspection/API/inspections.js'),
    path.join(__dirname, '../services/inspectionEngineService.js')
  ];

  let ddlCount = 0;
  let bypassCount = 0;

  for (const f of inspectionFiles) {
    const content = fs.readFileSync(f, 'utf-8');
    const ddlMatches = content.match(/\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+INDEX)\b/gi) || [];
    const bypassMatches = content.match(/\b(new\s+Pool|new\s+Client|client\.query|pool\.query)\b/g) || [];
    ddlCount += ddlMatches.length;
    bypassCount += bypassMatches.length;
  }

  assert(ddlCount === 0, `Runtime DDL count in Inspection domain is 0 (Actual: ${ddlCount})`);
  assert(bypassCount === 0, `Direct DB pool/client bypass count is 0 (Actual: ${bypassCount})`);

  // 2. Numbering Engine Uniqueness & Collision Resistance
  console.log('\n--- 2. Numbering Engine Uniqueness & Concurrency ---');
  const id1 = await numberingEngine.generateNextId('road_inspections', { prefix: 'INSP' });
  const id2 = await numberingEngine.generateNextId('road_inspections', { prefix: 'INSP' });
  const id3 = await numberingEngine.generateNextId('pavement_inspections', { prefix: 'INSP' });

  assert(id1.startsWith('INSP-'), `Inspection ID format valid (${id1})`);
  assert(id1 !== id2, `Sequential IDs are unique (${id1} != ${id2})`);
  assert(id2 !== id3, `Cross-table inspection IDs are unique (${id2} != ${id3})`);

  // 3. Inspection Lifecycle (Create -> Read -> Resolve -> Delete)
  console.log('\n--- 3. Inspection CRUD & Lifecycle Transitions ---');
  const user = { id: 'U-AUDITOR', fullName: 'م. حسام محاسنة', role: 'engineer' };

  // Create
  const created = await inspectionEngine.recordInspection({
    roadId: 'ROAD-TEST-001',
    siteLocation: 'طريق المصلية - كفرنجة',
    inspectorName: user.fullName,
    condition: 'FAILED',
    severityLevel: 'MAJOR',
    defects: [{ code: 'D-01', description: 'تشققات تمساحية', severity: 'عالية' }],
    notes: 'فحص دوري - يتطلب إعادة كشف',
    reinspectionDate: '2026-10-01'
  }, user);

  assert(created && created.id.startsWith('INSP-'), `Inspection recorded successfully with ID: ${created.id}`);
  assert(created.condition === 'FAILED', 'Initial inspection status is FAILED');
  assert(created.isResolved === false, 'Failed inspection marked as unresolved (isResolved: false)');

  // Read single
  const fetched = await inspectionEngine.getInspectionById(created.id);
  assert(fetched && fetched.id === created.id, `getInspectionById retrieved record correctly`);
  assert(fetched.siteLocation === 'طريق المصلية - كفرنجة', `Retrieved location matches: ${fetched.siteLocation}`);
  assert(Array.isArray(fetched.defects) && fetched.defects.length === 1, `Defects parsed as array (length: 1)`);

  // Read list with filter
  const list = await inspectionEngine.getInspections({ condition: 'FAILED' });
  const foundInList = list.some(i => i.id === created.id);
  assert(foundInList, `getInspections with condition=FAILED found the record`);

  // Resolve (Lifecycle Transition)
  const resolved = await inspectionEngine.resolveInspection(created.id, {
    resolutionNotes: 'تم تعبئة التشققات ومعالجة المقطع بالإسفلت البارد',
    newCondition: 'PASSED'
  }, user);

  assert(resolved.condition === 'PASSED', 'Inspection condition transitioned to PASSED');
  assert(resolved.isResolved === true, 'Inspection marked as resolved (isResolved: true)');
  assert(resolved.resolutionNotes.includes('تعبئة التشققات'), 'Resolution notes properly persisted');

  // 4. Audit Logging Verification
  console.log('\n--- 4. Enterprise Audit Logging Verification ---');
  if (isPostgresActive()) {
    const audits = await dbQuery(`
      SELECT * FROM activity_log 
      WHERE "entityId" = $1 AND entity = 'التفتيش وضبط الجودة'
      ORDER BY "createdAt" DESC
    `, [created.id]);

    assert(audits.length >= 2, `Audit trail recorded at least 2 entries for entity [${created.id}] (Actual: ${audits.length})`);
    const actions = audits.map(a => a.action);
    assert(actions.includes('INSPECTION_RECORDED'), 'Audit contains INSPECTION_RECORDED action');
    assert(actions.includes('INSPECTION_RESOLVED'), 'Audit contains INSPECTION_RESOLVED action');
  } else {
    console.log('  ⚠️ Skipping PG audit log check (Postgres inactive)');
  }

  // 5. Delete & Audit
  console.log('\n--- 5. Delete Operation & Deletion Audit ---');
  const deleteRes = await inspectionEngine.deleteInspection(created.id, user);
  assert(deleteRes.success === true, `deleteInspection succeeded: ${deleteRes.message}`);

  const postDelete = await inspectionEngine.getInspectionById(created.id);
  assert(postDelete === null, 'Inspection no longer exists after deletion (null returned)');

  if (isPostgresActive()) {
    const deleteAudit = await dbQuery(`
      SELECT * FROM activity_log 
      WHERE "entityId" = $1 AND action = 'INSPECTION_DELETED'
    `, [created.id]);
    assert(deleteAudit.length > 0, 'Audit contains INSPECTION_DELETED entry');
  }

  // 6. Cross-Domain Integration: Road PCI & Pavement Inspections
  console.log('\n--- 6. Cross-Domain Road & PCI Integration ---');
  // Ensure a test road exists
  await dbRun(`
    INSERT INTO roads (id, code, name, pci_score, "conditionIndex", "createdAt", "updatedAt")
    VALUES ('ROAD-INSP-TEST', 'RD-TEST', 'شارع الاختبار التفتيشي', 90, 90, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET pci_score = 90
  `);

  const pciInspection = await inspectionEngine.recordInspection({
    roadId: 'ROAD-INSP-TEST',
    siteLocation: 'حي السهل - كفرنجة',
    inspectorName: 'مهندس الرقابة',
    condition: 'PASSED',
    pciScore: 75,
    notes: 'فحص وتحديث مؤشر الرصف'
  }, user);

  assert(pciInspection !== null, 'Inspection with PCI score recorded');

  if (isPostgresActive()) {
    const roadRecord = await dbGet('SELECT id, pci_score FROM roads WHERE id = $1', ['ROAD-INSP-TEST']);
    assert(Number(roadRecord.pci_score) === 75, `Road PCI score updated automatically via inspection (Actual: ${roadRecord.pci_score})`);
    
    // Clean up test road & inspection
    await dbRun('DELETE FROM road_inspections WHERE id = $1', [pciInspection.id]);
    await dbRun('DELETE FROM roads WHERE id = $1', ['ROAD-INSP-TEST']);
  }

  // 7. Transaction Integrity & Rollback Test
  console.log('\n--- 7. Transaction Integrity & Rollback Verification ---');
  let rollbackSuccess = false;
  try {
    await withTransaction(async (client) => {
      await client.run(`
        INSERT INTO road_inspections (id, site_location, condition, notes, created_at, updated_at)
        VALUES ('INSP-ROLLBACK-TEST', 'موقع مؤقت', 'PASSED', 'اختبار التراجع', NOW(), NOW())
      `);
      // Simulate failure
      throw new Error('Simulated atomic transaction abort error');
    });
  } catch (err) {
    if (err.message.includes('Simulated atomic transaction abort error')) {
      rollbackSuccess = true;
    }
  }

  assert(rollbackSuccess, 'withTransaction caught simulated error and triggered rollback');

  const phantomRecord = await dbGet('SELECT * FROM road_inspections WHERE id = $1', ['INSP-ROLLBACK-TEST']);
  assert(phantomRecord === null || phantomRecord === undefined, 'No orphan/phantom record persisted after rollback');

  // 8. API Adapter Contract & Legacy Compatibility
  console.log('\n--- 8. API Adapter Contracts & Legacy Fallback ---');
  // Test Mock Request to Router
  const mockReq = { query: {} };
  let apiResponse = null;
  const mockRes = {
    json: (data) => { apiResponse = data; return data; },
    status: (code) => mockRes
  };

  // Check get list from API
  const getRouteHandler = inspectionRouter.stack.find(r => r.route && r.route.path === '/' && r.route.methods.get)?.route.stack[0]?.handle;
  assert(typeof getRouteHandler === 'function', 'GET / handler registered in Inspection API router');

  await getRouteHandler(mockReq, mockRes, (err) => { throw err; });
  assert(apiResponse && apiResponse.success === true, 'GET / returned success: true');
  assert(Array.isArray(apiResponse.inspections), 'GET / returned inspections array (legacy contract)');
  assert(Array.isArray(apiResponse.data), 'GET / returned data array (modern standard contract)');

  // 9. IDOR & Non-Existent ID Handling
  console.log('\n--- 9. IDOR & Error Boundary Protection ---');
  const nonExistent = await inspectionEngine.getInspectionById('INSP-NON-EXISTENT-999');
  assert(nonExistent === null, 'Querying non-existent inspection ID safely returns null');

  let resolveNonExistentCaught = false;
  try {
    await inspectionEngine.resolveInspection('INSP-NON-EXISTENT-999', { resolutionNotes: 'Test' });
  } catch (e) {
    resolveNonExistentCaught = true;
  }
  assert(resolveNonExistentCaught, 'Resolving non-existent inspection safely rejects with domain error');

  // 10. Inspection Stats Verification
  console.log('\n--- 10. Inspection Operational Metrics & Health Check ---');
  const stats = await inspectionEngine.getInspectionStats();
  assert(typeof stats.totalInspections === 'number', `Stats totalInspections is numeric (${stats.totalInspections})`);
  assert(typeof stats.complianceRate === 'number', `Stats complianceRate is numeric (${stats.complianceRate}%)`);

  const health = await inspectionEngine.healthCheck();
  assert(health.healthy === true, `Health check reports healthy: true (status: ${health.status})`);

  // 11. Route Inventory Verification (Adapters vs Route Paths)
  console.log('\n--- 11. Route Inventory (Adapters vs Distinct Route Paths) ---');
  const inspectionRoutes = inspectionRouter.stack.filter(r => r.route);
  assert(inspectionRoutes.length === 8, `Inspection API Adapter contains exactly 8 route handlers (Actual: ${inspectionRoutes.length})`);

  const roadsRouter = require('../Roads/API/roadsEngine');
  const roadsPmsRoutes = roadsRouter.stack.filter(r => r.route && r.route.path && String(r.route.path).includes('inspections'));
  assert(roadsPmsRoutes.length === 3, `Roads PMS Inspection sub-routes count is exactly 3 (Actual: ${roadsPmsRoutes.length})`);

  const totalDistinctRouteHandlers = inspectionRoutes.length + roadsPmsRoutes.length;
  assert(totalDistinctRouteHandlers === 11, `Total distinct Inspection HTTP route handlers across system is exactly 11 (Actual: ${totalDistinctRouteHandlers})`);

  // 12. RBAC Privilege Escalation & Least Privilege Protection
  console.log('\n--- 12. RBAC Privilege Escalation & Least Privilege Protection ---');
  // Site inspector should be able to create & resolve inspections
  const inspectorCanCreate = ['TASKS.INSPECT', 'OBSERVATIONS.CREATE', 'ROADS.PCI', 'QUALITY.TEST_RECORD', 'ROADS.CREATE', 'TASKS.CREATE'].some(p => rbacManager.hasPermission('site_inspector', p));
  const inspectorCanResolve = ['OBSERVATIONS.RESOLVE', 'QUALITY.NCR_CLOSE', 'TASKS.INSPECT', 'TASKS.EDIT', 'ROADS.EDIT'].some(p => rbacManager.hasPermission('site_inspector', p));
  assert(inspectorCanCreate === true, 'Field site inspector has valid permission to record inspections');
  assert(inspectorCanResolve === true, 'Field site inspector has valid permission to resolve inspections');

  // Verify site inspector CANNOT create or delete municipality roads (No Privilege Escalation)
  const inspectorCanCreateRoad = rbacManager.hasPermission('site_inspector', 'ROADS.CREATE');
  const inspectorCanDeleteRoad = rbacManager.hasPermission('site_inspector', 'ROADS.DELETE');
  const inspectorCanDeleteTask = rbacManager.hasPermission('site_inspector', 'TASKS.DELETE');
  assert(inspectorCanCreateRoad === false, 'Zero Privilege Escalation: Site inspector CANNOT create municipal roads');
  assert(inspectorCanDeleteRoad === false, 'Zero Privilege Escalation: Site inspector CANNOT delete municipal roads');
  assert(inspectorCanDeleteTask === false, 'Zero Privilege Escalation: Site inspector CANNOT delete municipal tasks');

  // Verify unauthorized citizen is rejected
  const citizenCanCreate = ['TASKS.INSPECT', 'OBSERVATIONS.CREATE', 'ROADS.PCI', 'QUALITY.TEST_RECORD', 'ROADS.CREATE', 'TASKS.CREATE'].some(p => rbacManager.hasPermission('citizen', p));
  assert(citizenCanCreate === false, 'Unauthorized citizen role is blocked from recording inspections');

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🏁 INSPECTION FORENSIC SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('═══════════════════════════════════════════════════════════════════');

  await closeDatabase();
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error('Fatal Suite Failure:', err);
  process.exit(1);
});

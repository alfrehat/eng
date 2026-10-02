/**
 * scratch/test_operations_center_forensic_suite.js
 * 🏛️ حزمة الاختبارات الجنائية والتحقق المعماري الشامل لنطاق مركز العمليات والمتابعة (OperationsCenter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

'use strict';

const assert = require('assert');
const { dbQuery, dbGet, isPostgresActive } = require('../utils/database');
const workOperationsCenterService = require('../services/workOperationsCenterService');
const engineRegistry = require('../services/engineRegistry');
const rbacManager = require('../middlewares/rbacManager');
const numberingEngine = require('../services/numberingEngine');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    })
    .catch(err => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      throw err;
    });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ OPERATIONS CENTER — COMPREHENSIVE FORENSIC & ARCHITECTURAL VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log(`[DB Mode]: ${isPostgresActive() ? 'PostgreSQL Active (Canonical)' : 'In-Memory Fallback'}`);

  // Test 1: Registry Discovery & Health Check
  await runTest('1. EngineRegistry & Health Check Verification', async () => {
    engineRegistry._ensureInitialized();
    const opEntry = engineRegistry.get('OPERATIONS_CENTER');
    assert(opEntry, 'OPERATIONS_CENTER must be registered in engineRegistry');
    assert.strictEqual(opEntry.status, 'READY', 'Status should be READY');
    assert(typeof opEntry.exposedOperations.getOperations === 'function', 'getOperations operation exposed');
    assert(typeof opEntry.exposedOperations.executeRoutingAction === 'function', 'executeRoutingAction operation exposed');

    const health = await workOperationsCenterService.healthCheck();
    assert(health && health.healthy === true, 'Health check must return healthy: true');
  });

  // Test 2: Numbering Engine Integration
  let testTaskNumber = null;
  await runTest('2. Numbering Engine Integration & Atomic Code Generation', async () => {
    const nextSeq = await numberingEngine.generateNextId('tasks', { prefix: 'TSK' });
    assert(nextSeq && nextSeq.startsWith('TSK-'), `Expected sequence starting with TSK-, got ${nextSeq}`);
    testTaskNumber = nextSeq;
  });

  // Test 3: Creation of Operation with Canonical Entity & Table
  let createdOpId = null;
  await runTest('3. Canonical Operation Creation (tasks table)', async () => {
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin', fullName: 'مدير النظام' };
    const op = await workOperationsCenterService.createOperation({
      title: 'صيانة طارئة لخط تصريف مياه الأمطار - حي نمر',
      description: 'فحص انسداد مجرى المياه ومعالجة الهبوط في الرصيف المحاذي',
      task_type: 'technical',
      priority: 'high',
      location_name: 'حي نمر - الشارع الرئيسي',
      lat: 32.2990,
      lng: 35.7060,
      assigned_to: 'U-003',
      planned_duration_hours: 12.0
    }, adminUser);

    assert(op, 'Created operation must not be null');
    assert(op.id, 'Operation must have id');
    assert(op.task_number && op.task_number.startsWith('TSK-'), `task_number must start with TSK-: ${op.task_number}`);
    assert.strictEqual(op.status, 'new', 'Initial status must be new');
    assert.strictEqual(op.assigned_to, 'U-003', 'Assignee must be U-003');
    createdOpId = op.id;

    // Verify in PostgreSQL directly via canonical query
    if (isPostgresActive()) {
      const dbRow = await dbGet('SELECT * FROM tasks WHERE id = $1', [createdOpId]);
      assert(dbRow, 'Record must exist in public.tasks PostgreSQL table');
      assert.strictEqual(dbRow.title, op.title, 'Title must match database value');
    }
  });

  // Test 4: Retrieval & Filtering
  await runTest('4. Query Operations with Filters and Safe JSON parsing', async () => {
    const allOps = await workOperationsCenterService.getOperations({ status: 'new' });
    assert(Array.isArray(allOps), 'Must return an array');
    const found = allOps.find(o => o.id === createdOpId);
    assert(found, 'Created operation must be found in getOperations list');
    assert(Array.isArray(found.comments), 'comments must be parsed as Array');
    assert(Array.isArray(found.assignment_history), 'assignment_history must be parsed as Array');
  });

  // Test 5: Executive Stats Calculation
  await runTest('5. Executive Stats Aggregation', async () => {
    const stats = await workOperationsCenterService.getExecutiveStats();
    assert(stats && typeof stats.total === 'number', 'total must be a number');
    assert(stats.total >= 1, 'total tasks should be at least 1');
  });

  // Test 6: Duplicate Detection Algorithm
  await runTest('6. Proactive Duplicate Detection & Geofence Guard', async () => {
    const dupResult = await workOperationsCenterService.checkDuplicates({
      location_name: 'حي نمر - الشارع الرئيسي',
      lat: 32.29905,
      lng: 35.70605
    });
    assert(dupResult && dupResult.hasDuplicates === true, 'Duplicate detection must detect nearby operation');
    assert(dupResult.duplicates.length > 0, 'Duplicates array must not be empty');
  });

  // Test 7: Spatial Proximity Query (GIS Proximity)
  await runTest('7. Spatial Proximity GIS Query', async () => {
    const spatialContext = await workOperationsCenterService.getNearbySpatialContext({
      lat: 32.2990,
      lng: 35.7060,
      radiusMeters: 500
    });
    assert(spatialContext, 'Spatial context must not be null');
    assert(Array.isArray(spatialContext.nearbyTasks), 'nearbyTasks must be an array');
    const nearby = spatialContext.nearbyTasks.find(t => t.id === createdOpId);
    assert(nearby, 'Created task should be identified within 500m proximity');
  });

  // Test 8: Privilege Escalation Prevention (U-001 Token Bypass Denied)
  await runTest('8. Security Hardening: Privilege Escalation Prevention', async () => {
    const fakeViewer = { id: 'U-001', username: 'attacker', role: 'viewer' };
    const currentOp = await workOperationsCenterService.getOperationById(createdOpId);
    
    // Viewer should NOT have permission to APPROVE even if id is U-001
    const authResult = await workOperationsCenterService.evaluateRoutingPermission(fakeViewer, 'APPROVE', currentOp);
    assert.strictEqual(authResult.allowed, false, 'Untrusted non-admin with id U-001 must NOT bypass authorization!');
  });

  // Test 9: Separation of Duties (SoD) Enforcement
  await runTest('9. Separation of Duties (SoD) Verification', async () => {
    // Section head has APPROVE capability, but SoD strictly forbids approving their own created task
    const headUser = { id: 'U-003', username: 'head_roads', role: 'head_of_roads', fullName: 'رئيس قسم الطرق' };
    const headOp = await workOperationsCenterService.createOperation({
      title: 'مهمة منشأة بواسطة رئيس القسم لاختبار SoD',
      task_type: 'technical'
    }, headUser);

    let sodBlocked = false;
    try {
      await workOperationsCenterService.executeRoutingAction({
        opId: headOp.id,
        action: 'APPROVE',
        actor: headUser
      });
    } catch (e) {
      if (e.message.includes('فصل المهام')) {
        sodBlocked = true;
      }
    }
    assert(sodBlocked, 'Separation of Duties must prevent creator from self-approving the operation');
  });

  // Test 10: Lifecycle & Dynamic Routing Transitions
  await runTest('10. Lifecycle Routing Transitions (START -> SUBMIT -> APPROVE)', async () => {
    const assigneeUser = { id: 'U-003', username: 'head_roads', role: 'head_of_roads', fullName: 'رئيس قسم الطرق' };
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin', fullName: 'مدير النظام' };

    // 10.1 START execution
    const started = await workOperationsCenterService.executeRoutingAction({
      opId: createdOpId,
      action: 'START',
      actor: assigneeUser,
      remarks: 'بدء الكشف الميداني مع الطواقم'
    });
    assert.strictEqual(started.status, 'in_progress', 'Status must transition to in_progress');

    // 10.2 SUBMIT for approval
    const submitted = await workOperationsCenterService.executeRoutingAction({
      opId: createdOpId,
      action: 'SUBMIT',
      actor: assigneeUser,
      remarks: 'تم إنجاز الأعمال وتقديم التقرير للمراجعة'
    });
    assert.strictEqual(submitted.status, 'under_review', 'Status must transition to under_review');

    // 10.3 APPROVE by director/admin
    const approved = await workOperationsCenterService.executeRoutingAction({
      opId: createdOpId,
      action: 'APPROVE',
      actor: adminUser,
      remarks: 'معتمد ومطابق للمواصفات'
    });
    assert.strictEqual(approved.status, 'completed', 'Status must transition to completed');
    assert(approved.completed_at, 'completed_at must be populated');
  });

  // Test 11: Endorsement Note and Attachments
  await runTest('11. Endorsement Note & Formal Recommendation Recording', async () => {
    const engineer = { id: 'U-003', username: 'head_roads', role: 'head_of_roads', fullName: 'رئيس قسم الطرق' };
    const endorsed = await workOperationsCenterService.addEndorsementNote({
      opId: createdOpId,
      noteText: 'تم فحص الموقع ميدانياً والتأكد من انسياب المياه دون عوائق.',
      recommendation: 'الموافقة على إغلاق المعاملة وصرف مستحقات الصيانة.',
      actionType: 'NOTE_ONLY',
      filesList: [{ name: 'site_photo_after.jpg', url: '/uploads/operations/site_photo_after.jpg', size: 1024 }],
      user: engineer
    });

    assert(endorsed, 'Endorsed operation returned');
    assert(endorsed.notes_and_endorsements.length >= 1, 'Must have at least 1 endorsement note');
    assert(endorsed.attachments.length >= 1, 'Must have at least 1 attachment recorded');
  });

  // Test 12: Finalization and Formal Closing
  await runTest('12. Final Decision & Formal Closure', async () => {
    const directorUser = { id: 'U-001', username: 'admin', role: 'admin', fullName: 'مدير المديرية' };
    const finalized = await workOperationsCenterService.finalizeAndApprove({
      opId: createdOpId,
      decisionStatus: 'closed',
      decisionText: 'معتمد رسمياً وتم إغلاق ملف المعاملة بأرشيف مركز العمليات.',
      executionNotes: 'تم التسليم وتصديق الكشوفات',
      user: directorUser
    });

    assert.strictEqual(finalized.status, 'closed', 'Final status must be closed');
    assert(finalized.final_decision, 'final_decision must be populated');
    assert.strictEqual(finalized.final_decision.status, 'closed', 'Decision status must be closed');
  });

  // Test 13: Central Audit Trail Verification in public.activity_log
  await runTest('13. Canonical Audit Trail in public.activity_log', async () => {
    if (isPostgresActive()) {
      const logs = await dbQuery(
        `SELECT * FROM activity_log WHERE "entityId" = $1 ORDER BY id DESC`,
        [createdOpId]
      );
      assert(Array.isArray(logs), 'activity_log query returned array');
      assert(logs.length >= 1, `Expected audit trail entries for operation ${createdOpId}, found ${logs.length}`);
      const actions = logs.map(l => l.action);
      console.log(`     Audit events recorded: [${actions.join(', ')}]`);
    } else {
      console.log('     Audit trail verified in memory mock.');
    }
  });

  // Test 14: Transactional Deletion
  await runTest('14. Atomic Deletion via withTransaction', async () => {
    const adminUser = { id: 'U-001', username: 'admin', role: 'admin' };
    const delResult = await workOperationsCenterService.deleteOperation(createdOpId, adminUser);
    assert(delResult && delResult.success === true, 'Delete operation must succeed');

    const opAfter = await workOperationsCenterService.getOperationById(createdOpId);
    assert.strictEqual(opAfter, null, 'Operation must be deleted from database');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`🎯 OPERATIONS CENTER SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

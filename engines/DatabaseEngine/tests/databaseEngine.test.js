/**
 * engines/DatabaseEngine/tests/databaseEngine.test.js
 * Automated Test Suite for DatabaseEngine, UnitOfWork, EnterpriseEventBus, and BaseRepository
 */

require('dotenv').config();
const { databaseEngine } = require('../index');
const { EnterpriseEventBus } = require('../../Common/EnterpriseEventBus');
const DomainEvent = require('../../Common/DomainEvent');
const BaseRepository = require('../../Common/BaseRepository');
const AppError = require('../../Common/AppError');

async function runTests() {
  console.log('🧪 Starting Enterprise DatabaseEngine Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASS: ${message}`);
      passed++;
    }
  }

  try {
    // 1. Health Check Test
    console.log('--- Test 1: Database Health Check ---');
    const health = await databaseEngine.checkHealth();
    assert(health.healthy === true, 'DatabaseEngine should report healthy status');
    assert(health.status === 'POSTGRES_HEALTHY', 'Status should be POSTGRES_HEALTHY');
    console.log(`Connected DB: ${health.database}, Response: ${health.responseTimeMs}ms\n`);

    // 2. Enterprise Event Bus Test
    console.log('--- Test 2: Enterprise Event Bus ---');
    const testBus = new EnterpriseEventBus();
    let receivedEvent = null;

    testBus.subscribe('ProjectCreated', (evt) => {
      receivedEvent = evt;
    });

    const evt = new DomainEvent('ProjectCreated', 'PRJ-101', 'Project', { name: 'تعبيد طريق عين جنة' }, { actor: 'ENG_AHMAD' });
    await testBus.publish(evt);

    assert(receivedEvent !== null, 'Subscriber must receive published event');
    assert(receivedEvent.aggregateId === 'PRJ-101', 'Event aggregateId must match');
    assert(receivedEvent.payload.name === 'تعبيد طريق عين جنة', 'Event payload must match');
    assert(receivedEvent.metadata.actor === 'ENG_AHMAD', 'Event actor must match');
    console.log('');

    // 3. Transaction Commit & Event Dispatch Test
    console.log('--- Test 3: UnitOfWork Transaction Commit & Event Dispatch ---');
    let commitDispatched = false;
    testBus.subscribe('TransactionCommittedEvent', () => {
      commitDispatched = true;
    });

    // Create a test table inside postgres for verification
    await databaseEngine.query(`
      CREATE TABLE IF NOT EXISTS public.test_uow_items (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100),
        updated_at TIMESTAMP,
        updated_by VARCHAR(100),
        version INT DEFAULT 1
      )
    `);
    await databaseEngine.query('TRUNCATE TABLE public.test_uow_items');

    const commitResult = await databaseEngine.withTransaction(async (uow) => {
      const res = await uow.query(
        'INSERT INTO test_uow_items (title, created_by) VALUES ($1, $2) RETURNING id, title',
        ['مخطط كفرنجة التفصيلي', 'ADMIN']
      );
      uow.registerDomainEvent(
        new DomainEvent('TransactionCommittedEvent', res.rows[0].id, 'TestItem', { title: res.rows[0].title })
      );
      return res.rows[0];
    });

    assert(commitResult.title === 'مخطط كفرنجة التفصيلي', 'Transaction should return committed row');
    const verifyRow = await databaseEngine.queryOne('SELECT * FROM test_uow_items WHERE id = $1', [commitResult.id]);
    assert(verifyRow !== null, 'Row must exist after commit');
    console.log('');

    // 4. Transaction Rollback on Error Test
    console.log('--- Test 4: Transaction Rollback on Error ---');
    let rollbackEventDispatched = false;
    testBus.subscribe('ShouldNeverDispatch', () => {
      rollbackEventDispatched = true;
    });

    let caughtError = null;
    try {
      await databaseEngine.withTransaction(async (uow) => {
        await uow.query('INSERT INTO test_uow_items (title, created_by) VALUES ($1, $2)', ['بيانات سيتم التراجع عنها', 'TEST']);
        uow.registerDomainEvent(new DomainEvent('ShouldNeverDispatch', 'TEMP', 'Test', {}));
        throw new Error('Simulated Business Failure');
      });
    } catch (e) {
      caughtError = e;
    }

    assert(caughtError !== null, 'Transaction must throw on error');
    assert(caughtError.message === 'Simulated Business Failure', 'Must rethrow original error');

    const checkRollback = await databaseEngine.queryRows(
      'SELECT * FROM test_uow_items WHERE title = $1',
      ['بيانات سيتم التراجع عنها']
    );
    assert(checkRollback.length === 0, 'Rolled back row must NOT exist in database');
    assert(rollbackEventDispatched === false, 'Domain events from rolled back transaction must NOT be dispatched');
    console.log('');

    // 5. BaseRepository Operations & Optimistic Concurrency Test
    console.log('--- Test 5: BaseRepository CRUD & Optimistic Locking ---');
    const testRepo = new BaseRepository('test_uow_items', 'id');

    // Insert via BaseRepository
    const inserted = await testRepo.insert({ title: 'عطاء دراسات مرورية' }, 'CHIEF_ENGINEER');
    assert(inserted.id !== undefined, 'Insert should generate primary key');
    assert(inserted.created_by === 'CHIEF_ENGINEER', 'Insert should stamp actor');
    assert(inserted.version === 1, 'Initial version should be 1');

    // Update with version check
    const updated = await testRepo.update(inserted.id, { title: 'عطاء دراسات مرورية محدث' }, 1, 'DIRECTOR');
    assert(updated.title === 'عطاء دراسات مرورية محدث', 'Update should apply new values');
    assert(updated.version === 2, 'Version should increment to 2');
    assert(updated.updated_by === 'DIRECTOR', 'Updated by must be stamped');

    // Optimistic Concurrency Conflict Test
    let conflictOccurred = false;
    try {
      // Trying to update with stale version 1 instead of current 2
      await testRepo.update(inserted.id, { title: 'محاولة تعديل بنسخة قديمة' }, 1, 'USER_X');
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) {
        conflictOccurred = true;
      }
    }
    assert(conflictOccurred === true, 'Stale version update must throw AppError 409 Conflict');
    console.log('');

  } catch (suiteError) {
    console.error('💥 Suite Fatal Error:', suiteError.message);
  } finally {
    try {
      await databaseEngine.query('DROP TABLE IF EXISTS public.test_uow_items');
    } catch (dropErr) {}
    await databaseEngine.close();
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

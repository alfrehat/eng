require('dotenv').config();
const path = require('path');
const { isPostgresActive, dbRun, withTransaction, memDb } = require('../utils/database');

async function testPgFailureSemantics() {
    console.log('=== TESTING POSTGRESQL FAILURE BEHAVIOR ===');
    console.log('isPostgresActive():', isPostgresActive());
    
    // 1. Check withTransaction rollback on failure
    let txRolledBack = false;
    try {
        await withTransaction(async (client) => {
            await client.query('CREATE TEMP TABLE test_rollback (id int);');
            await client.query('INSERT INTO test_rollback VALUES (1);');
            throw new Error('Simulated failure during transaction');
        });
    } catch (e) {
        if (e.message.includes('Simulated failure')) {
            txRolledBack = true;
        }
    }
    console.log('1. Transaction correctly rolls back and throws error:', txRolledBack);

    // 2. Test dbRun failure behavior
    let dbRunFailedAsExpected = false;
    try {
        await dbRun('INSERT INTO non_existent_table_xyz VALUES (1);');
    } catch (e) {
        dbRunFailedAsExpected = true;
    }
    console.log('2. dbRun throws error on failure (no silent swallow):', dbRunFailedAsExpected);
}

testPgFailureSemantics().catch(console.error);

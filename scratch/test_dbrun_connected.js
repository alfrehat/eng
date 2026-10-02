require('dotenv').config();
const { isPostgresActive, dbRun, withTransaction, getPool } = require('../utils/database');

async function test() {
    // wait 100ms for pool.query('SELECT NOW()') to finish
    await new Promise(r => setTimeout(r, 200));

    console.log('After waiting 200ms:');
    console.log('isPostgresActive():', isPostgresActive());

    let threw = false;
    try {
        await dbRun('INSERT INTO non_existent_table_xyz VALUES (1);');
    } catch (e) {
        threw = true;
        console.log('Expected error caught:', e.message);
    }
    console.log('dbRun threw as expected:', threw);
}

test().catch(console.error);

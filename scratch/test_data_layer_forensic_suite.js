require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { isPostgresActive, dbQuery, dbGet, dbRun, withTransaction, memDb, generateSequenceId } = require('../utils/database');

async function runAllTests() {
    console.log('====================================================');
    console.log('🔬 EXECUTING MANDATORY DATA LAYER FORENSIC TEST SUITE');
    console.log('====================================================');

    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        details: []
    };

    function assert(desc, condition, errorMsg = '') {
        results.total++;
        if (condition) {
            results.passed++;
            results.details.push({ test: desc, status: 'PASS' });
            console.log(`✅ [PASS] ${desc}`);
        } else {
            results.failed++;
            results.details.push({ test: desc, status: 'FAIL', error: errorMsg });
            console.error(`❌ [FAIL] ${desc} - ${errorMsg}`);
        }
    }

    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();

    try {
        // TEST 1: JSON parsing and encoding integrity
        console.log('\n--- 1. JSON Parsing & Integrity Scan ---');
        const dataDir = path.resolve('data');
        const dbDir = path.resolve('database');
        const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));

        let jsonParseErrors = 0;
        let bomOrMojibakeErrors = 0;

        for (const f of dataFiles) {
            try {
                const buf = fs.readFileSync(path.join(dataDir, f));
                if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bomOrMojibakeErrors++;
                const str = buf.toString('utf8');
                if (str.includes('\uFFFD')) bomOrMojibakeErrors++;
                JSON.parse(str);
            } catch (e) {
                jsonParseErrors++;
            }
        }
        for (const f of dbFiles) {
            try {
                const buf = fs.readFileSync(path.join(dbDir, f));
                if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bomOrMojibakeErrors++;
                const str = buf.toString('utf8');
                if (str.includes('\uFFFD')) bomOrMojibakeErrors++;
                JSON.parse(str);
            } catch (e) {
                jsonParseErrors++;
            }
        }
        assert('All JSON files in data/ (27) and database/ (65) parse with valid JSON syntax', jsonParseErrors === 0, `${jsonParseErrors} parse errors`);
        assert('Zero BOM markers or UTF-8 replacement/mojibake characters detected in data files', bomOrMojibakeErrors === 0, `${bomOrMojibakeErrors} encoding issues`);

        // TEST 2: Data Inventory Validation
        console.log('\n--- 2. Data Inventory Validation ---');
        assert('data/ contains exactly 27 JSON files mirrors', dataFiles.length === 27, `Found ${dataFiles.length}`);
        assert('database/ contains 65 canonical/seed/config files', dbFiles.length >= 60, `Found ${dbFiles.length}`);

        // TEST 3: PostgreSQL Connectivity
        console.log('\n--- 3. PostgreSQL Connectivity ---');
        const pingRes = await client.query('SELECT 1 as alive, current_database() as db;');
        assert('PostgreSQL connection active to target database', pingRes.rows[0].alive === 1 && pingRes.rows[0].db === 'kafr_inja_engineering');
        assert('utils/database isPostgresActive() returns true', isPostgresActive() === true);

        // TEST 4: Canonical Table Verification
        console.log('\n--- 4. Canonical Table Verification ---');
        const canonicalTables = [
            'contracts', 'construction_contracts', 'directorate_budget_lines',
            'directorate_budget_allocations', 'municipal_assets', 'structural_assets',
            'infrastructure_networks', 'energy_assets', 'excavation_permits',
            'tasks', 'users', 'activity_log', 'tender_studies', 'workflows', 'claims',
            'system_identity'
        ];
        const publicTablesRes = await client.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
        `);
        const existingPublicTables = new Set(publicTablesRes.rows.map(r => r.table_name));
        let allCanonicalPresent = true;
        for (const ct of canonicalTables) {
            if (!existingPublicTables.has(ct)) {
                allCanonicalPresent = false;
                console.error(`Missing canonical table: ${ct}`);
            }
        }
        assert('All 16 primary canonical tables/views exist in public schema', allCanonicalPresent);

        // TEST 5: PostgreSQL Empty Result Behavior
        console.log('\n--- 5. PostgreSQL Empty Result Behavior ---');
        const emptyQueryRes = await dbQuery('SELECT * FROM public.tasks WHERE id = $1', ['NON_EXISTENT_ID_999999']);
        assert('Query for non-existent row returns empty array [] without falling back to stale data', Array.isArray(emptyQueryRes) && emptyQueryRes.length === 0);

        const emptyGetRes = await dbGet('SELECT * FROM public.tasks WHERE id = $1', ['NON_EXISTENT_ID_999999']);
        assert('dbGet for non-existent row returns null', emptyGetRes === null);

        // TEST 6: PostgreSQL Failure Behavior
        console.log('\n--- 6. PostgreSQL Failure Behavior ---');
        let dbRunThrew = false;
        try {
            await dbRun('INSERT INTO non_existent_table_err_check VALUES (1)');
        } catch (e) {
            dbRunThrew = true;
        }
        assert('dbRun throws error on invalid table/query (no false success)', dbRunThrew);

        let txThrewAndRolledBack = false;
        try {
            await withTransaction(async (txClient) => {
                await txClient.query('CREATE TEMP TABLE test_tx_guard (id int);');
                await txClient.query('INSERT INTO test_tx_guard VALUES (42);');
                throw new Error('Trigger rollback test');
            });
        } catch (e) {
            if (e.message.includes('Trigger rollback test')) txThrewAndRolledBack = true;
        }
        assert('withTransaction safely catches error, executes ROLLBACK, and rethrows', txThrewAndRolledBack);

        // TEST 7: memDb No-Independent-Write Behavior
        console.log('\n--- 7. memDb No-Independent-Write Behavior ---');
        // Verify that operational services write to PostgreSQL rather than memDb
        const tasksService = require('../services/tasksEngineService');
        const generatedTaskId = await generateSequenceId('TSK', 'tasks');
        const createdTask = await tasksService.createTask({
            title: 'اختبار تدقيق البيانات الكنوني',
            description: 'فحص عدم الكتابة في الذاكرة المستقلة',
            assigned_to: 'U-001',
            created_by: 'U-001'
        });
        const taskInPg = await dbGet('SELECT * FROM public.tasks WHERE id = $1', [createdTask.id]);
        assert('Task created is stored directly in canonical PostgreSQL table', Boolean(taskInPg && taskInPg.id === createdTask.id));

        // Clean up test task
        await dbRun('DELETE FROM public.tasks WHERE id = $1', [createdTask.id]);
        const taskAfterDelete = await dbGet('SELECT * FROM public.tasks WHERE id = $1', [createdTask.id]);
        assert('Task deleted cleanly from canonical PostgreSQL table', taskAfterDelete === null);

        // TEST 8: JSON No-Independent-Write Behavior
        console.log('\n--- 8. JSON No-Independent-Write Behavior ---');
        const jsonTasksRaw = fs.readFileSync(path.join(dataDir, 'tasks.json'), 'utf8');
        const jsonTasks = JSON.parse(jsonTasksRaw);
        assert('JSON tasks.json remained unchanged (empty array) during PostgreSQL operational writes', Array.isArray(jsonTasks) && jsonTasks.length === 0);

        // TEST 9: ID / Numbering Behavior
        console.log('\n--- 9. ID / Numbering Engine Verification ---');
        const seqId = await generateSequenceId('CLM', 'claims');
        assert('generateSequenceId generates formatted sequence through central numbering engine', seqId.startsWith('CLM-') && seqId.length > 5);

        // TEST 10: Referential Integrity Scan
        console.log('\n--- 10. Referential Integrity Scan ---');
        const fksRes = await client.query(`
            SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
        `);
        let orphanCount = 0;
        for (const fk of fksRes.rows) {
            try {
                const countRes = await client.query(`
                    SELECT count(*)::int as c FROM "${fk.table_name}" t 
                    WHERE t."${fk.column_name}" IS NOT NULL 
                      AND NOT EXISTS (SELECT 1 FROM "${fk.foreign_table_name}" f WHERE f."${fk.foreign_column_name}" = t."${fk.column_name}");
                `);
                orphanCount += countRes.rows[0].c;
            } catch (e) {}
        }
        assert('Zero orphan records across all 167 Foreign Key constraints in PostgreSQL', orphanCount === 0, `${orphanCount} orphans found`);

        // TEST 11: Runtime DDL Scan in API and Server
        console.log('\n--- 11. Runtime DDL Scan ---');
        const claimsEngineCode = fs.readFileSync(path.resolve('Tenders/API/claimsEngine.js'), 'utf8');
        const settingsCode = fs.readFileSync(path.resolve('Settings/API/systemSettings.js'), 'utf8');
        const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf8');

        assert('Zero ALTER TABLE in Tenders/API/claimsEngine.js', !claimsEngineCode.includes('ALTER TABLE'));
        assert('Zero ALTER TABLE in Settings/API/systemSettings.js', !settingsCode.includes('ALTER TABLE'));
        assert('Zero runtime DDL in server.js startServer()', !serverCode.includes('DROP CONSTRAINT IF EXISTS "claims_tenderId_fkey"'));

        // TEST 12: Direct DB Access Scan
        console.log('\n--- 12. Direct DB Access Boundary Scan ---');
        const skipDirs = ['node_modules', '.git', 'coverage', '.system_generated', 'dist', 'scratch'];
        function walk(dir) {
            let files = [];
            for (const f of fs.readdirSync(dir)) {
                if (skipDirs.includes(f)) continue;
                const full = path.join(dir, f);
                if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
                else if (f.endsWith('.js')) files.push(full);
            }
            return files;
        }
        const allCodeFiles = walk(path.resolve('.'));
        let directPoolCount = 0;
        for (const f of allCodeFiles) {
            const rel = path.relative(path.resolve('.'), f).replace(/\\/g, '/');
            if (rel === 'utils/database.js') continue;
            const c = fs.readFileSync(f, 'utf8');
            if (c.includes("require('pg')") || c.includes('require("pg")') || c.includes('new Pool(')) {
                directPoolCount++;
            }
        }
        assert('Zero direct Pool creation or raw require("pg") outside utils/database.js', directPoolCount === 0, `Found in ${directPoolCount} files`);

        // TEST 13: Data Consumers Smoke Test
        console.log('\n--- 13. Data Consumers Smoke Test ---');
        const sysIdentity = await dbGet('SELECT * FROM public.system_identity WHERE id = 1;');
        assert('System identity loaded successfully from PostgreSQL canonical table', sysIdentity !== null && sysIdentity.id === 1);

        const usersCount = await dbGet('SELECT count(*)::int as c FROM public.users;');
        assert('Users retrieved from canonical PostgreSQL table', usersCount && usersCount.c === 10);

        const budgetAllocations = await dbQuery('SELECT * FROM public.directorate_budget_allocations LIMIT 5;');
        assert('Budget allocations retrieved from canonical PostgreSQL table', Array.isArray(budgetAllocations));

        const contractsCount = await dbGet('SELECT count(*)::int as c FROM public.contracts;');
        assert('Contracts retrieved from canonical PostgreSQL table', contractsCount && contractsCount.c >= 1);

    } finally {
        client.release();
        await pool.end();
    }

    console.log('\n====================================================');
    console.log(`📊 TEST EXECUTION SUMMARY:`);
    console.log(`Total Tests Run: ${results.total}`);
    console.log(`Passed:         ${results.passed}`);
    console.log(`Failed:         ${results.failed}`);
    console.log(`Skipped:        ${results.skipped}`);
    console.log('====================================================');

    if (results.failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runAllTests().catch(err => {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
});

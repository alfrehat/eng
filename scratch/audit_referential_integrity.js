const { Pool } = require('pg');
require('dotenv').config();

async function run() {
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    console.log('=== REFERENTIAL INTEGRITY AUDIT IN POSTGRESQL ===');

    // 1. Get foreign key constraints
    const fksRes = await client.query(`
        SELECT
            tc.table_schema, 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
    `);

    console.log(`Foreign Key Constraints found: ${fksRes.rows.length}`);

    // Check each FK for orphan rows
    let totalOrphans = 0;
    const orphanFindings = [];

    for (const fk of fksRes.rows) {
        try {
            const sql = `
                SELECT count(*)::int as orphan_count 
                FROM "${fk.table_name}" t
                WHERE t."${fk.column_name}" IS NOT NULL 
                  AND NOT EXISTS (
                      SELECT 1 FROM "${fk.foreign_table_name}" f 
                      WHERE f."${fk.foreign_column_name}" = t."${fk.column_name}"
                  )
            `;
            const countRes = await client.query(sql);
            const orphanCount = countRes.rows[0].orphan_count;
            if (orphanCount > 0) {
                totalOrphans += orphanCount;
                orphanFindings.push({
                    table: fk.table_name,
                    column: fk.column_name,
                    foreignTable: fk.foreign_table_name,
                    foreignColumn: fk.foreign_column_name,
                    orphanCount
                });
            }
        } catch (err) {
            // column type mismatch or constraint definition anomaly
            console.warn(`FK check error on ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}: ${err.message}`);
        }
    }

    console.log(`Total orphan rows across FKs: ${totalOrphans}`);
    if (orphanFindings.length > 0) {
        console.log('Orphan findings:', orphanFindings);
    } else {
        console.log('Zero orphan rows across all defined Foreign Keys!');
    }

    // 2. Also check common soft relationships (e.g. tender_id, project_id, contract_id, user_id) in key tables even if no hard FK exists
    const softRelations = [
        { childTable: 'claims', childCol: 'tenderId', parentTable: 'tenders', parentCol: 'id' },
        { childTable: 'claims', childCol: 'tender_id', parentTable: 'tenders', parentCol: 'id' },
        { childTable: 'tender_studies', childCol: 'tender_id', parentTable: 'tenders', parentCol: 'id' },
        { childTable: 'contract_clauses', childCol: 'contract_id', parentTable: 'construction_contracts', parentCol: 'id' },
        { childTable: 'contract_variation_orders', childCol: 'contract_id', parentTable: 'construction_contracts', parentCol: 'id' },
        { childTable: 'bank_guarantees', childCol: 'tender_id', parentTable: 'tenders', parentCol: 'id' },
        { childTable: 'directorate_budget_allocations', childCol: 'line_id', parentTable: 'directorate_budget_lines', parentCol: 'id' },
        { childTable: 'role_permissions', childCol: 'role_id', parentTable: 'roles', parentCol: 'id' }
    ];

    console.log('\n=== SOFT RELATIONSHIP ORPHAN CHECK ===');
    const softOrphans = [];
    for (const rel of softRelations) {
        try {
            const sql = `
                SELECT count(*)::int as orphan_count 
                FROM "${rel.childTable}" t
                WHERE t."${rel.childCol}" IS NOT NULL 
                  AND t."${rel.childCol}"::text != ''
                  AND NOT EXISTS (
                      SELECT 1 FROM "${rel.parentTable}" p 
                      WHERE p."${rel.parentCol}"::text = t."${rel.childCol}"::text
                  )
            `;
            const res = await client.query(sql);
            const count = res.rows[0].orphan_count;
            if (count > 0) {
                softOrphans.push({ ...rel, orphanCount: count });
            }
        } catch (e) {
            // table or column may not exist or empty
        }
    }
    console.log(`Soft relation orphan count: ${softOrphans.length}`);
    softOrphans.forEach(o => console.log(`- ${o.childTable}.${o.childCol} -> ${o.parentTable}.${o.parentCol}: ${o.orphanCount} orphans`));

    // 3. Duplicate IDs check across public tables
    console.log('\n=== DUPLICATE PRIMARY KEY SCAN ===');
    const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    let tablesWithDuplicateIds = 0;
    for (const r of tables.rows) {
        try {
            const dupRes = await client.query(`
                SELECT id, count(*)::int as c 
                FROM "${r.table_name}" 
                WHERE id IS NOT NULL 
                GROUP BY id 
                HAVING count(*) > 1;
            `);
            if (dupRes.rows.length > 0) {
                tablesWithDuplicateIds++;
                console.log(`Duplicate IDs in table [${r.table_name}]: ${dupRes.rows.length} duplicate IDs`);
            }
        } catch (e) {
            // Some tables might not have an 'id' column
        }
    }
    console.log(`Tables with duplicate IDs: ${tablesWithDuplicateIds}`);

    client.release();
    await pool.end();
}

run().catch(console.error);

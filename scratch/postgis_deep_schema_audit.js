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
    console.log('=== POSTGIS DEEP SCHEMA & INTEGRITY AUDIT ===');

    try {
        // 1. Check geometry_columns view
        const geomColsRes = await client.query(`
            SELECT f_table_schema, f_table_name, f_geometry_column, coord_dimension, srid, type 
            FROM geometry_columns
            WHERE f_table_schema = 'public'
            ORDER BY f_table_name;
        `);
        console.log(`\n1. PostGIS Registered Geometry Columns (${geomColsRes.rows.length}):`);
        console.table(geomColsRes.rows);

        // 2. Check GIST indexes for each geometry column
        console.log('\n2. GIST Spatial Indexes Check:');
        const gistRes = await client.query(`
            SELECT 
                t.relname AS table_name,
                i.relname AS index_name,
                am.amname AS index_type,
                a.attname AS column_name
            FROM pg_index x
            JOIN pg_class t ON t.oid = x.indrelid
            JOIN pg_class i ON i.oid = x.indexrelid
            JOIN pg_am am ON am.oid = i.relam
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(x.indkey)
            WHERE n.nspname = 'public' AND am.amname = 'gist'
            ORDER BY t.relname;
        `);
        console.log(`Found ${gistRes.rows.length} GIST indexes:`);
        console.table(gistRes.rows);

        // Map which geometry columns have GIST indexes
        const indexedCols = new Set(gistRes.rows.map(r => `${r.table_name}.${r.column_name}`));
        const missingGist = [];
        for (const gc of geomColsRes.rows) {
            const key = `${gc.f_table_name}.${gc.f_geometry_column}`;
            if (!indexedCols.has(key)) {
                missingGist.push(key);
            }
        }
        console.log('\nMissing GIST indexes on geometry columns:', missingGist);

        // 3. Geometry Validity, SRID, and Count checks on each table
        console.log('\n3. Geometry Integrity Check across Tables:');
        const integrityResults = [];

        for (const gc of geomColsRes.rows) {
            const tbl = gc.f_table_name;
            const col = gc.f_geometry_column;

            try {
                const countRes = await client.query(`SELECT count(*)::int as total FROM "${tbl}"`);
                const totalRows = countRes.rows[0].total;

                if (totalRows === 0) {
                    integrityResults.push({
                        table: tbl,
                        column: col,
                        totalRows: 0,
                        nonNullGeom: 0,
                        validGeom: 0,
                        invalidGeom: 0,
                        sridMatches: 0,
                        status: 'EMPTY_TABLE'
                    });
                    continue;
                }

                const statsRes = await client.query(`
                    SELECT 
                        count(*)::int as non_null,
                        count(CASE WHEN ST_IsValid("${col}") THEN 1 END)::int as valid_count,
                        count(CASE WHEN NOT ST_IsValid("${col}") THEN 1 END)::int as invalid_count,
                        count(CASE WHEN ST_SRID("${col}") = ${gc.srid} THEN 1 END)::int as matching_srid_count,
                        count(CASE WHEN ST_IsEmpty("${col}") THEN 1 END)::int as empty_geom_count
                    FROM "${tbl}"
                    WHERE "${col}" IS NOT NULL;
                `);

                const stats = statsRes.rows[0];
                integrityResults.push({
                    table: tbl,
                    column: col,
                    totalRows,
                    nonNullGeom: stats.non_null,
                    validGeom: stats.valid_count,
                    invalidGeom: stats.invalid_count,
                    sridMatches: stats.matching_srid_count,
                    status: stats.invalid_count === 0 ? 'HEALTHY' : 'CORRUPTED'
                });
            } catch (err) {
                integrityResults.push({
                    table: tbl,
                    column: col,
                    status: 'ERROR: ' + err.message
                });
            }
        }

        console.table(integrityResults);

    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(console.error);

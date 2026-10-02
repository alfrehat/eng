const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    const rootDir = path.resolve('.');
    console.log('=== FORENSIC GIS AUDIT ===');

    // 1. Check GIS/Pages/unifiedGisEngine.js
    const gisPath = path.join(rootDir, 'GIS', 'Pages', 'unifiedGisEngine.js');
    console.log('GIS/Pages/unifiedGisEngine.js exists:', fs.existsSync(gisPath));

    // 2. Search for GIS routes in server.js or routes
    const serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    const serverGisMatches = [];
    serverJs.split('\n').forEach((line, idx) => {
        if (/gis|spatial|geometry|geography|postgis/i.test(line)) {
            serverGisMatches.push({ line: idx + 1, code: line.trim() });
        }
    });
    console.log(`server.js GIS references (${serverGisMatches.length}):`);
    serverGisMatches.forEach(m => console.log(`  L${m.line}: ${m.code}`));

    // 3. PostGIS and Geometry inspection in PostgreSQL
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    try {
        // Check PostGIS extension
        const extRes = await client.query(`
            SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
        `);
        console.log('\nPostGIS Extension installed:', extRes.rows);

        // Check geometry_columns view
        let geomCols = [];
        try {
            const gcRes = await client.query(`
                SELECT f_table_schema, f_table_name, f_geometry_column, coord_dimension, srid, type 
                FROM geometry_columns;
            `);
            geomCols = gcRes.rows;
            console.log(`\ngeometry_columns count: ${geomCols.length}`);
            console.log(geomCols);
        } catch (e) {
            console.warn('geometry_columns query note:', e.message);
        }

        // Check any column having data_type 'USER-DEFINED' or udt_name 'geometry' or 'geography'
        const rawGeomCols = await client.query(`
            SELECT table_schema, table_name, column_name, udt_name, data_type 
            FROM information_schema.columns 
            WHERE udt_name IN ('geometry', 'geography') OR column_name ~* 'geom|geometry|coord|lat|lng|latitude|longitude'
            ORDER BY table_schema, table_name, column_name;
        `);
        console.log(`\nPotential spatial / coordinate columns in DB: ${rawGeomCols.rows.length}`);
        console.log(rawGeomCols.rows);

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);

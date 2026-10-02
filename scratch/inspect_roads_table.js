const { Pool } = require('pg');
require('dotenv').config();

async function check() {
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    try {
        const cols = await client.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'roads'
            ORDER BY ordinal_position;
        `);
        console.log('Columns in public.roads:');
        console.table(cols.rows);

        const rows = await client.query(`
            SELECT id, name, category, ST_AsGeoJSON(geom) as geojson, start_lat, start_lng
            FROM public.roads;
        `);
        console.log('Existing roads in public.roads:');
        console.log(rows.rows);
    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);

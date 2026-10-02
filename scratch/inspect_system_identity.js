const { Pool } = require('pg');
require('dotenv').config();

async function inspect() {
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    const res = await client.query('SELECT * FROM system_identity WHERE id = 1;');
    console.log('system_identity row 1 exists:', res.rows.length > 0);
    if (res.rows.length > 0) {
        console.log('app_title:', res.rows[0].app_title);
        console.log('municipality_name:', res.rows[0].municipality_name);
    }
    client.release();
    await pool.end();
}

inspect().catch(console.error);

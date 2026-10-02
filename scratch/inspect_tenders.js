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
    const tenders = await client.query('SELECT id, "tenderNumber", title FROM tenders;');
    console.log('tenders rows count:', tenders.rows.length);
    console.log('tenders rows:', tenders.rows);
    client.release();
    await pool.end();
}

inspect().catch(console.error);

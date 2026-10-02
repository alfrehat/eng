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
        const claimsCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'claims' 
            ORDER BY ordinal_position;
        `);
        console.log('Claims columns in DB:', claimsCols.rows.map(r => r.column_name));

        const identityCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_identity' 
            ORDER BY ordinal_position;
        `);
        console.log('System identity columns in DB:', identityCols.rows.map(r => r.column_name));
    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);

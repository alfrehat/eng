const fs = require('fs');
const path = require('path');
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
    try {
        const sql = fs.readFileSync(path.resolve('migrations', '022_canonical_claims_and_settings_schema.sql'), 'utf8');
        console.log('Executing Migration 022...');
        await client.query(sql);
        console.log('Migration 022 executed successfully!');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(console.error);

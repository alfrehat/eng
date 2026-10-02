const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
    const dataDir = path.resolve('data');
    const dbDir = path.resolve('database');

    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

    const results = [];
    for (const file of dataFiles) {
        const entity = file.replace('.json', '');
        const dataPath = path.join(dataDir, file);
        const dbPath = path.join(dbDir, file);

        const dataContent = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const dbContent = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : null;

        const dataCount = Array.isArray(dataContent) ? dataContent.length : 1;
        const dbDirCount = dbContent ? (Array.isArray(dbContent) ? dbContent.length : 1) : null;

        let pgTable = entity;
        if (entity === 'contracts') pgTable = 'construction_contracts';
        if (entity === 'projects') pgTable = 'v2_projects';

        let pgCount = null;
        try {
            const r = await client.query(`SELECT count(*)::int as c FROM "${pgTable}"`);
            pgCount = r.rows[0].c;
        } catch (e) {
            pgCount = 'NO_TABLE';
        }

        let state = 'MATCH';
        if (pgCount !== 'NO_TABLE') {
            if (pgCount === dataCount) state = 'MATCH';
            else if (dataCount === 0 && pgCount > 0) state = 'PG_ACTIVE_JSON_EMPTY';
            else if (pgCount > dataCount) state = 'PG_AHEAD';
            else if (pgCount < dataCount) state = 'JSON_AHEAD';
        } else {
            state = 'JSON_ONLY';
        }

        results.push({
            file,
            pgTable,
            dataCount,
            dbDirCount,
            pgCount,
            state
        });
    }

    console.table(results);
    client.release();
    await pool.end();
}

run().catch(console.error);

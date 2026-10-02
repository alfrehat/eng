const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    const dataDir = path.resolve('data');
    const databaseDir = path.resolve('database');

    console.log('=== DATA FORENSIC ANALYSIS ===');
    const dataFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
    const databaseFiles = fs.existsSync(databaseDir) ? fs.readdirSync(databaseDir) : [];

    console.log(`Files in data/: ${dataFiles.length}`);
    console.log(`Files in database/: ${databaseFiles.length}`);

    // Check JSON parsing and encoding for data/
    let dataIntegrity = { valid: 0, invalid: 0, nonJson: 0, errors: [] };
    for (const f of dataFiles) {
        const fullPath = path.join(dataDir, f);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        if (f.endsWith('.json')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                // check mojibake or bad encoding
                if (content.includes('ï»¿') || content.includes('Ø§') || content.includes('Ù…')) {
                    // check if Arabic or mojibake
                }
                JSON.parse(content);
                dataIntegrity.valid++;
            } catch (err) {
                dataIntegrity.invalid++;
                dataIntegrity.errors.push({ file: f, error: err.message });
            }
        } else {
            dataIntegrity.nonJson++;
        }
    }

    // Check JSON parsing and encoding for database/
    let dbIntegrity = { valid: 0, invalid: 0, nonJson: 0, errors: [] };
    for (const f of databaseFiles) {
        const fullPath = path.join(databaseDir, f);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        if (f.endsWith('.json')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                JSON.parse(content);
                dbIntegrity.valid++;
            } catch (err) {
                dbIntegrity.invalid++;
                dbIntegrity.errors.push({ file: f, error: err.message });
            }
        } else {
            dbIntegrity.nonJson++;
        }
    }

    console.log('data/ integrity:', dataIntegrity);
    console.log('database/ integrity:', dbIntegrity);

    // Check PostgreSQL connection
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    let client;
    try {
        client = await pool.connect();
        console.log('Connected to PostgreSQL successfully.');
        const res = await client.query(`
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log(`Total public tables/views: ${res.rows.length}`);
    } catch (e) {
        console.error('PostgreSQL connection error:', e.message);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

main().catch(err => console.error(err));

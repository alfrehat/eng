const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runAudit() {
    const rootDir = path.resolve('.');
    const dataDir = path.join(rootDir, 'data');
    const dbDir = path.join(rootDir, 'database');

    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();

    console.log('=== FORENSIC DATA INVENTORY & COMPARISON ===');

    const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));

    const allEntities = Array.from(new Set([...dataFiles, ...dbFiles])).map(f => f.replace('.json', ''));

    // Get all tables in PG
    const tableRes = await client.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    `);
    const pgTables = new Set(tableRes.rows.map(r => r.table_name));

    const inventory = [];

    for (const entity of allEntities) {
        const inData = fs.existsSync(path.join(dataDir, `${entity}.json`));
        const inDbDir = fs.existsSync(path.join(dbDir, `${entity}.json`));

        let dataCount = null;
        let dbDirCount = null;
        let pgCount = null;
        let status = 'UNKNOWN';

        if (inData) {
            try {
                const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, `${entity}.json`), 'utf8'));
                dataCount = Array.isArray(parsed) ? parsed.length : 1;
            } catch (e) {
                dataCount = 'INVALID_JSON';
            }
        }

        if (inDbDir) {
            try {
                const parsed = JSON.parse(fs.readFileSync(path.join(dbDir, `${entity}.json`), 'utf8'));
                dbDirCount = Array.isArray(parsed) ? parsed.length : 1;
            } catch (e) {
                dbDirCount = 'INVALID_JSON';
            }
        }

        let canonicalTable = null;
        if (pgTables.has(entity)) {
            canonicalTable = entity;
        } else if (entity === 'contracts' && pgTables.has('construction_contracts')) {
            canonicalTable = 'construction_contracts';
        } else if (entity === 'projects' && pgTables.has('v2_projects')) {
            canonicalTable = 'v2_projects';
        }

        if (canonicalTable) {
            try {
                const res = await client.query(`SELECT count(*)::int as c FROM "${canonicalTable}"`);
                pgCount = res.rows[0].c;
            } catch (e) {
                pgCount = 'ERR: ' + e.message;
            }
        }

        // Determine Status
        if (canonicalTable) {
            if (pgCount === dataCount || pgCount === dbDirCount) {
                status = 'MATCH';
            } else if (dataCount === 0 || dbDirCount === 0) {
                status = 'PG_CANONICAL_EMPTY_JSON';
            } else if (pgCount > 0 && (dataCount || 0) < pgCount) {
                status = 'PG_AHEAD_JSON_OUTDATED';
            } else if (pgCount === 0 && (dataCount || 0) > 0) {
                status = 'JSON_AHEAD_SEED';
            } else {
                status = 'COUNT_DISCREPANCY';
            }
        } else {
            status = 'NO_PG_TABLE_CONFIG_OR_REFERENCE';
        }

        inventory.push({
            entity,
            canonicalTable: canonicalTable || 'NONE',
            inData,
            dataCount,
            inDbDir,
            dbDirCount,
            pgCount,
            status
        });
    }

    console.log(JSON.stringify(inventory, null, 2));

    // Check secrets scan across data/ and database/
    console.log('\n=== SECRETS SCAN IN DATA & DATABASE DIRECTORIES ===');
    const secretMatches = [];
    const sensitivePatterns = [
        /(?:password|passwd|pwd)\s*["']?\s*[:=]\s*["']([^"'\s]+)["']/i,
        /(?:api[_-]?key|secret[_-]?key|access[_-]?token|jwt[_-]?secret)\s*["']?\s*[:=]\s*["']([^"'\s]+)["']/i,
        /-----BEGIN (?:RSA |EC |PGP )?PRIVATE KEY-----/
    ];

    const checkDirForSecrets = (dirName, dirPath) => {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
        for (const f of files) {
            const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
            for (const pat of sensitivePatterns) {
                const m = content.match(pat);
                if (m) {
                    // Check if it's users.json password hash or plaintext
                    if (f === 'users.json' && m[0].includes('password')) {
                        // inspect if bcrypt hash ($2a$ / $2b$) or plaintext
                        const users = JSON.parse(content);
                        const plaintextUsers = users.filter(u => u.password && !u.password.startsWith('$2'));
                        if (plaintextUsers.length > 0) {
                            secretMatches.push({ dir: dirName, file: f, issue: `Found ${plaintextUsers.length} plaintext passwords in users.json` });
                        }
                    } else {
                        secretMatches.push({ dir: dirName, file: f, issue: `Sensitive pattern matched: ${m[0].split(':')[0]}` });
                    }
                }
            }
        }
    };

    checkDirForSecrets('data', dataDir);
    checkDirForSecrets('database', dbDir);

    console.log(`Secret matches found: ${secretMatches.length}`);
    secretMatches.forEach(s => console.log(s));

    // Check Mojibake / encoding
    console.log('\n=== ENCODING & MOJIBAKE SCAN ===');
    const encodingIssues = [];
    const checkDirForEncoding = (dirName, dirPath) => {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
        for (const f of files) {
            const buf = fs.readFileSync(path.join(dirPath, f));
            // Check BOM
            if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
                encodingIssues.push({ dir: dirName, file: f, issue: 'UTF-8 BOM detected' });
            }
            const content = buf.toString('utf8');
            // Check replacement characters or mojibake
            if (content.includes('\uFFFD')) {
                encodingIssues.push({ dir: dirName, file: f, issue: 'Replacement character U+FFFD detected' });
            }
            if (/Ã[\x80-\xBF]|Ø§|Ù…|Ø±/.test(content)) {
                // Wait, Arabic characters Ø§ or Ù… in raw utf8 are NOT mojibake if viewed as UTF-8, but if the string itself contains the literal characters Ø§ that means ISO-8859-1 double encoding!
                // In properly encoded UTF-8, Arabic is 0xD8-0xD9 in bytes, which decodes to Arabic characters like 'ا', 'م'.
                // If the decoded JS string literally contains 'Ø', then it's mojibake!
                if (/[\u00C0-\u00FF][\u0080-\u00BF]/.test(content)) {
                    encodingIssues.push({ dir: dirName, file: f, issue: 'Potential Latin-1/UTF-8 mojibake detected' });
                }
            }
        }
    };
    checkDirForEncoding('data', dataDir);
    checkDirForEncoding('database', dbDir);
    console.log(`Encoding issues found: ${encodingIssues.length}`);
    encodingIssues.forEach(e => console.log(e));

    client.release();
    await pool.end();
}

runAudit().catch(console.error);

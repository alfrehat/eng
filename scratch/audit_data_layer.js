/**
 * scratch/audit_data_layer.js
 * Comprehensive Forensic Audit of data/ and database/ layers
 */

'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initDatabase, getPool, isPostgresActive, dbQuery, dbGet } = require('../utils/database');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_DIR = path.join(ROOT, 'database');

async function main() {
  const pool = initDatabase();
  if (pool) {
    try { await pool.query('SELECT NOW()'); } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 100));

  console.log('PostgreSQL Active:', isPostgresActive());

  const dataFiles = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
  const dbFiles = fs.existsSync(DB_DIR) ? fs.readdirSync(DB_DIR) : [];

  console.log(`\n=== 1. FILES IN data/ (${dataFiles.length}) ===`);
  const dataReport = [];
  for (const f of dataFiles) {
    const fullPath = path.join(DATA_DIR, f);
    const stat = fs.statSync(fullPath);
    let validJson = false;
    let count = 0;
    let sampleKeys = [];
    let isArray = false;
    let corruptedUtf8 = false;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('ï»¿') || content.includes('\uFFFD')) {
        corruptedUtf8 = true;
      }
      const parsed = JSON.parse(content);
      validJson = true;
      if (Array.isArray(parsed)) {
        isArray = true;
        count = parsed.length;
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          sampleKeys = Object.keys(parsed[0]).slice(0, 5);
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        count = Object.keys(parsed).length;
        sampleKeys = Object.keys(parsed).slice(0, 5);
      }
    } catch (e) {
      validJson = false;
    }

    dataReport.push({
      file: f,
      size: stat.size,
      validJson,
      isArray,
      count,
      corruptedUtf8,
      sampleKeys
    });
  }
  console.log(JSON.stringify(dataReport, null, 2));

  console.log(`\n=== 2. FILES IN database/ (${dbFiles.length}) ===`);
  const dbReport = [];
  for (const f of dbFiles) {
    const fullPath = path.join(DB_DIR, f);
    const stat = fs.statSync(fullPath);
    let validJson = false;
    let count = 0;
    let sampleKeys = [];
    let isArray = false;
    let corruptedUtf8 = false;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('ï»¿') || content.includes('\uFFFD')) {
        corruptedUtf8 = true;
      }
      const parsed = JSON.parse(content);
      validJson = true;
      if (Array.isArray(parsed)) {
        isArray = true;
        count = parsed.length;
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          sampleKeys = Object.keys(parsed[0]).slice(0, 5);
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        count = Object.keys(parsed).length;
        sampleKeys = Object.keys(parsed).slice(0, 5);
      }
    } catch (e) {
      validJson = false;
    }

    dbReport.push({
      file: f,
      size: stat.size,
      validJson,
      isArray,
      count,
      corruptedUtf8,
      sampleKeys
    });
  }
  console.log(JSON.stringify(dbReport, null, 2));

  // 3. Compare with PostgreSQL tables
  console.log('\n=== 3. POSTGRESQL CANONICAL COMPARISON ===');
  if (isPostgresActive()) {
    const pgTables = await dbQuery("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log(`Found ${pgTables.length} PostgreSQL tables/views in public schema`);

    const comparisons = [];
    for (const d of dataReport) {
      const entityName = d.file.replace(/\.json$/, '');
      const match = pgTables.find(t => t.table_name.toLowerCase() === entityName.toLowerCase());
      let pgCount = null;
      let tableType = null;
      if (match) {
        tableType = match.table_type;
        try {
          const cRes = await dbGet(`SELECT count(*) as cnt FROM public."${match.table_name}"`);
          pgCount = parseInt(cRes.cnt, 10);
        } catch (e) {
          pgCount = 'ERR: ' + e.message;
        }
      }
      comparisons.push({
        file: d.file,
        jsonCount: d.count,
        pgTable: match ? match.table_name : null,
        tableType,
        pgCount,
        status: !match ? 'NO_PG_TABLE' : (pgCount === d.count ? 'MATCH_COUNT' : 'COUNT_DIFF')
      });
    }
    console.log(JSON.stringify(comparisons, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

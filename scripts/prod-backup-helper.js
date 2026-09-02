/**
 * scripts/prod-backup-helper.js
 * مساعد النسخ الاحتياطي المشفر بـ AES-256
 * بلدية كفرنجة الجديدة
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isPostgresActive, getPool, memDb } = require('../utils/database');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');
const PASSPHRASE = process.env.BACKUP_ENCRYPTION_KEY || 'KafrInjaEnterprise2026SecureKey';

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
  const encName = `kafr_inja_backup_${timestamp}.enc`;
  const encFilePath = path.join(BACKUP_DIR, encName);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      system: 'نظام إدارة الأشغال - بلدية كفرنجة الجديدة',
      version: '1.0.0 Enterprise'
    },
    tables: {}
  };

  const pool = getPool();
  const tablesToDump = [
    'users', 'tenders', 'claims', 'purchases', 'tasks', 'contracts', 'roads',
    'structural_assets', 'infrastructure_networks', 'energy_assets',
    'excavation_permits', 'paving_returns', 'archive', 'system_settings', 'activity_log'
  ];

  if (isPostgresActive() && pool) {
    for (const table of tablesToDump) {
      try {
        const res = await pool.query(`SELECT * FROM public.${table}`);
        backupData.tables[table] = res.rows;
      } catch (err) {}
    }
  }

  for (const table of tablesToDump) {
    if (!backupData.tables[table] || backupData.tables[table].length === 0) {
      if (memDb && memDb[table]) {
        backupData.tables[table] = memDb[table];
      } else {
        const p = path.join(PROJECT_ROOT, 'database', `${table}.json`);
        if (fs.existsSync(p)) {
          try {
            backupData.tables[table] = JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
          } catch (e) {
            backupData.tables[table] = [];
          }
        }
      }
    }
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(PASSPHRASE, salt, 10000, 32, 'sha256');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const finalEncryptedObject = {
    timestamp: new Date().toISOString(),
    system: 'نظام إدارة الأشغال - بلدية كفرنجة الجديدة',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    data: encrypted
  };

  fs.writeFileSync(encFilePath, JSON.stringify(finalEncryptedObject, null, 2), 'utf8');
  const stat = fs.statSync(encFilePath);

  return {
    filename: encName,
    path: encFilePath,
    sizeKb: Math.round((stat.size / 1024) * 10) / 10,
    timestamp: finalEncryptedObject.timestamp
  };
}

async function restoreBackup(fileContentOrPath) {
  let backupData = null;

  try {
    let parsedObj = null;
    if (typeof fileContentOrPath === 'object' && fileContentOrPath !== null) {
      parsedObj = fileContentOrPath;
    } else if (typeof fileContentOrPath === 'string' && fs.existsSync(fileContentOrPath)) {
      parsedObj = JSON.parse(fs.readFileSync(fileContentOrPath, 'utf8'));
    } else {
      parsedObj = JSON.parse(String(fileContentOrPath));
    }

    // If encrypted AES-256-CBC backup
    if (parsedObj.salt && parsedObj.iv && parsedObj.data) {
      const salt = Buffer.from(parsedObj.salt, 'hex');
      const iv = Buffer.from(parsedObj.iv, 'hex');
      const key = crypto.pbkdf2Sync(PASSPHRASE, salt, 10000, 32, 'sha256');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(parsedObj.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      backupData = JSON.parse(decrypted);
    } else if (parsedObj.tables) {
      backupData = parsedObj;
    } else {
      // Direct table dump format
      backupData = { tables: parsedObj };
    }

    const pool = getPool();
    let restoredCount = 0;

    if (backupData && backupData.tables) {
      for (const [table, rows] of Object.entries(backupData.tables)) {
        if (!Array.isArray(rows)) continue;

        // Restore to in-memory/JSON
        memDb[table] = rows;
        const p = path.join(PROJECT_ROOT, 'database', `${table}.json`);
        try {
          fs.writeFileSync(p, JSON.stringify(rows, null, 2), 'utf8');
        } catch (e) {}

        // Restore to PostgreSQL if active
        if (isPostgresActive() && pool && rows.length > 0) {
          try {
            await pool.query(`TRUNCATE TABLE public.${table} CASCADE`);
            for (const row of rows) {
              const keys = Object.keys(row);
              const vals = Object.values(row).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
              const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
              const quotedKeys = keys.map(k => `"${k}"`).join(', ');
              await pool.query(`INSERT INTO public.${table} (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
            }
          } catch (pgErr) {}
        }
        restoredCount++;
      }
    }

    return {
      success: true,
      restoredTables: restoredCount,
      timestamp: backupData.metadata?.timestamp || new Date().toISOString()
    };
  } catch (err) {
    throw new Error('فشل فك تشفير أو استرجاع النسخة الاحتياطية: ' + err.message);
  }
}

module.exports = { runBackup, restoreBackup };

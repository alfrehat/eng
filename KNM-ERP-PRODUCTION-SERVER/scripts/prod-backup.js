/**
 * scripts/prod-backup.js
 * سكريبت النسخ الاحتياطي والتشفير التلقائي الموحد (Cross-Platform AES-256 Encrypted Backup)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

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

  console.log('⚡ Starting Enterprise Backup Task...');

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      system: 'نظام إدارة الأشغال - بلدية كفرنجة الجديدة',
      version: '1.0.0 Enterprise'
    },
    tables: {}
  };

  // 1. استخراج الجداول من PostgreSQL إن كانت متوفرة
  let pool = null;
  try {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'Alfrehat@1994',
      database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const tablesToDump = [
      'users', 'tenders', 'claims', 'purchases', 'tasks', 'contracts', 'roads',
      'rams_roads', 'rams_segments', 'rams_maintenance_history',
      'structural_assets', 'infrastructure_networks', 'energy_assets',
      'excavation_permits', 'paving_returns', 'archive', 'system_settings'
    ];

    for (const table of tablesToDump) {
      try {
        const res = await pool.query(`SELECT * FROM public.${table}`);
        backupData.tables[table] = res.rows;
      } catch (err) {
        // Table might not exist or be empty
      }
    }
    console.log('✅ PostgreSQL tables extracted.');
  } catch (dbErr) {
    console.warn('⚠️ Could not connect to PostgreSQL for backup, reading JSON files:', dbErr.message);
  } finally {
    if (pool) await pool.end();
  }

  // 2. تجميع ملفات الـ JSON لضمان عدم ضياع أي بيانات
  const jsonTables = [
    'users', 'tenders', 'claims', 'purchases', 'tasks', 'contracts', 'roads',
    'structural_assets', 'infrastructure_networks', 'energy_assets',
    'excavation_permits', 'paving_returns', 'archive', 'system_settings', 'activity_log'
  ];

  for (const table of jsonTables) {
    if (!backupData.tables[table] || backupData.tables[table].length === 0) {
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

  // 3. التشفير بـ AES-256-CBC
  try {
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

    console.log(`\n✅ Production Encrypted Backup Saved: ${encFilePath}`);
    console.log(`📦 Size: ${(fs.statSync(encFilePath).size / 1024).toFixed(2)} KB\n`);
  } catch (encErr) {
    console.error('❌ Backup Encryption Failed:', encErr.message);
  }
}

runBackup();

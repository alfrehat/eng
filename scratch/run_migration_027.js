const fs = require('fs');
const path = require('path');
const { getPool, isPostgresActive, dbRun } = require('../utils/database');

async function applyMigration() {
  console.log('Applying migration 027_canonical_token_blacklist.sql...');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '027_canonical_token_blacklist.sql'), 'utf8');
  
  if (isPostgresActive()) {
    const pool = getPool();
    await pool.query(sql);
    console.log('✅ Migration 027 applied successfully to PostgreSQL!');
  } else {
    console.log('ℹ️ PostgreSQL is not active; skipping DB migration.');
  }
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

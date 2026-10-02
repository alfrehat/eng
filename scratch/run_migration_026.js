const fs = require('fs');
const path = require('path');
const { getPool } = require('../utils/database');

(async () => {
  const pool = getPool();
  try {
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../migrations/026_canonical_activity_log_indexes.sql'),
      'utf8'
    );
    console.log('Applying migration 026...');
    await pool.query(migrationSql);
    console.log('Migration 026 applied successfully.');

    const idx = await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'activity_log' ORDER BY indexname;
    `);
    console.log('Updated indexes on activity_log:');
    console.table(idx.rows);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
})();

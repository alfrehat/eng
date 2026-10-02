const fs = require('fs');
const path = require('path');
const { dbQuery, closeDatabase } = require('../utils/database');

async function runMigration() {
  console.log('Running Migration 025...');
  let sql = fs.readFileSync(path.join(__dirname, '../migrations/025_canonical_inspection_schema.sql'), 'utf-8');
  
  // Strip comments
  sql = sql.replace(/--.*$/gm, '');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    console.log('Executing:', statement.replace(/\s+/g, ' ').substring(0, 70) + '...');
    await dbQuery(statement);
  }

  console.log('✅ Migration 025 applied successfully.');
  
  // Verify columns in road_inspections
  const cols = await dbQuery(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'road_inspections'
    ORDER BY ordinal_position
  `);
  console.log('road_inspections updated columns:\n', cols.map(c => c.column_name).join(', '));

  await closeDatabase();
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Migration 025 failed:', err);
  process.exit(1);
});

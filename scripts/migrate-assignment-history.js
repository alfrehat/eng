const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kafr_inja_engineering'
});

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_history JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('✅ PostgreSQL assignment_history column added successfully!');
  } catch(e) {
    console.error('PostgreSQL error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();

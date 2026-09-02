const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kafr_inja_engineering'
});

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entity_geometry JSONB;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_context JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('✅ PostgreSQL entity_geometry & source_context columns added successfully!');
  } catch(e) {
    console.error('PostgreSQL error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();

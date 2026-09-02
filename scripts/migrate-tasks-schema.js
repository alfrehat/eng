const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kafr_inja_engineering'
});

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        task_number VARCHAR(50) UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'technical';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS org_unit_id VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS co_assignees JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(100);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_entity VARCHAR(255);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_duration_hours NUMERIC(10,2) DEFAULT 24.0;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_duration_hours NUMERIC(10,2) DEFAULT 0.0;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_hours NUMERIC(10,2) DEFAULT 48.0;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_status VARCHAR(50) DEFAULT 'ON_TRACK';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entity_id VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entity_name VARCHAR(255);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS appeal_number VARCHAR(100);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS appeal_date VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS citizen_name VARCHAR(255);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS citizen_phone VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS field_report JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approvals JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('✅ PostgreSQL tasks schema synchronized successfully!');
  } catch(e) {
    console.error('PostgreSQL error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();

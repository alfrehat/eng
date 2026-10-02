const { getPool } = require('../utils/database');

(async () => {
  const pool = getPool();

  // 1. Sample of IDs
  const sample = await pool.query(`
    SELECT id, "userId", action, entity, "createdAt" 
    FROM activity_log 
    ORDER BY "createdAt" DESC 
    LIMIT 20;
  `);
  console.log('--- RECENT 20 LOG IDs ---');
  console.table(sample.rows);

  // 2. ID patterns in PostgreSQL
  const patterns = await pool.query(`
    SELECT 
      CASE 
        WHEN id LIKE 'ACT-%' THEN 'ACT-timestamp-rand'
        WHEN id LIKE 'LOG-INSP-%' THEN 'LOG-INSP-timestamp-rand'
        WHEN id LIKE 'LOG-TSK-%' THEN 'LOG-TSK-timestamp-rand'
        WHEN id LIKE 'LOG-AST-%' THEN 'LOG-AST-timestamp-rand'
        WHEN id LIKE 'LOG-%' THEN 'LOG-timestamp-rand'
        WHEN id ~ '^[0-9]+$' THEN 'Numeric sequence'
        WHEN id ~ '^[a-f0-9-]{36}$' THEN 'UUID'
        ELSE 'Other'
      END as pattern,
      count(*) as count
    FROM activity_log
    GROUP BY 1
    ORDER BY count DESC;
  `);
  console.log('--- ID PATTERNS IN POSTGRESQL ---');
  console.table(patterns.rows);

  // 3. Foreign key references to activity_log
  const fkRefs = await pool.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_name = 'activity_log';
  `);
  console.log('--- FK REFERENCES TO ACTIVITY_LOG ---');
  console.table(fkRefs.rows);

  process.exit(0);
})();

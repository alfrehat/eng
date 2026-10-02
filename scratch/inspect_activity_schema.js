const { getPool } = require('../utils/database');
(async () => {
  const pool = getPool();
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'activity_log' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('COLUMNS:');
  console.table(res.rows);

  const idx = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'activity_log';
  `);
  console.log('INDEXES:');
  console.table(idx.rows);

  const count = await pool.query('SELECT count(*) FROM activity_log');
  console.log('ROW COUNT:', count.rows[0].count);

  const sample = await pool.query('SELECT * FROM activity_log ORDER BY "createdAt" DESC LIMIT 3');
  console.log('SAMPLE ROW:', sample.rows[0]);

  process.exit(0);
})();

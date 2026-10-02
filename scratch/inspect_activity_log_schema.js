const { dbQuery } = require('../utils/database');

async function main() {
  const cols = await dbQuery(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'activity_log'
    ORDER BY ordinal_position
  `);
  console.log('--- COLUMNS ---');
  console.table(cols);

  const pkey = await dbQuery(`
    SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'activity_log'
  `);
  console.log('--- CONSTRAINTS ---');
  console.table(pkey);

  const idxs = await dbQuery(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'activity_log'
  `);
  console.log('--- INDEXES ---');
  console.table(idxs);

  const cnt = await dbQuery('SELECT count(*) FROM activity_log');
  console.log('--- ROW COUNT ---:', cnt[0].count);

  const sample = await dbQuery('SELECT * FROM activity_log ORDER BY "createdAt" DESC LIMIT 3');
  console.log('--- SAMPLE ROWS ---:', sample);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

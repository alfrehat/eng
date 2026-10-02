const { dbQuery, closeDatabase } = require('../utils/database');

async function check() {
  const cols = await dbQuery(`
    SELECT column_name, data_type, character_maximum_length, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchases' 
    ORDER BY ordinal_position
  `);
  console.log('purchases columns in PostgreSQL:');
  console.table(cols);

  const count = await dbQuery('SELECT COUNT(*) as count FROM public.purchases');
  console.log('purchases row count:', count[0].count);

  if (typeof closeDatabase === 'function') await closeDatabase();
}

check();

const db = require('../utils/database');

async function main() {
  await db.initDatabase();

  const tables = await db.dbQuery(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name ILIKE '%inspect%'
    ORDER BY table_name;
  `);
  console.log('Tables matching *inspect*:');
  console.table(tables);

  for (const t of tables) {
    const cols = await db.dbQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t.table_name]);
    console.log(`\nTable ${t.table_name} (${cols.length} cols):`, cols.map(c => c.column_name).join(', '));
  }

  await db.closeDatabase();
}

main();

const { dbQuery } = require('../utils/database');

async function main() {
  const allTables = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  const migTables = allTables.filter(t => t.table_name.toLowerCase().includes('migrat'));
  console.log('Migration tracking tables:', migTables.map(t => t.table_name));

  const tables = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%project%' OR table_name ILIKE '%portfolio%' OR table_name ILIKE '%plan%')
    ORDER BY table_name;
  `);
  try {
    const pTest = await dbQuery('SELECT * FROM public.projects LIMIT 1');
    console.log('public.projects exists! Rows:', pTest.length);
  } catch (e) {
    console.log('public.projects does NOT exist or failed:', e.message);
  }

  try {
    const v2pTest = await dbQuery('SELECT * FROM public.v2_projects LIMIT 1');
    console.log('public.v2_projects exists! Rows:', v2pTest.length);
  } catch (e) {
    console.log('public.v2_projects does NOT exist or failed:', e.message);
  }

  for (const t of tables) {
    const cols = await dbQuery(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t.table_name]);
    console.log(`\nTable [${t.table_name}] columns:`);
    cols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

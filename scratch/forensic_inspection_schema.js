const db = require('../utils/database');

async function main() {
  try {
    await db.initDatabase();

    // 1. Check all tables and views containing 'inspect'
    const tables = await db.dbQuery(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%inspect%'
      ORDER BY table_name;
    `);
    console.log('--- TABLES/VIEWS MATCHING *inspect* ---');
    console.table(tables);

    // 2. Check columns of all matching tables
    for (const t of tables) {
      const cols = await db.dbQuery(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t.table_name]);
      console.log(`\nColumns for ${t.table_name}:`);
      console.table(cols);
    }

    // 3. Check row counts
    for (const t of tables) {
      if (t.table_type === 'BASE TABLE') {
        const countRes = await db.dbGet(`SELECT count(*)::int as cnt FROM public."${t.table_name}"`);
        console.log(`Row count for ${t.table_name}:`, countRes.cnt);
      }
    }

    // 4. Check foreign keys referencing or referenced by inspection tables
    const fks = await db.dbQuery(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name ILIKE '%inspect%' OR ccu.table_name ILIKE '%inspect%');
    `);
    console.log('\n--- FOREIGN KEYS FOR INSPECTION TABLES ---');
    console.table(fks);

    await db.closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting inspection schema:', err);
    process.exit(1);
  }
}

main();

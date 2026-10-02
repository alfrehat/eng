const db = require('../utils/database');

async function main() {
  await db.initDatabase();

  const trgs = await db.dbQuery(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement 
    FROM information_schema.triggers 
    WHERE event_object_table IN ('pavement_inspections', 'road_inspections');
  `);
  console.log('Triggers:', trgs);

  const constrs = await db.dbQuery(`
    SELECT constraint_name, table_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name IN ('pavement_inspections', 'road_inspections');
  `);
  console.log('\nConstraints:');
  console.table(constrs);

  const idxs = await db.dbQuery(`
    SELECT indexname, tablename, indexdef 
    FROM pg_indexes 
    WHERE tablename IN ('pavement_inspections', 'road_inspections');
  `);
  console.log('\nIndexes:');
  console.table(idxs);

  await db.closeDatabase();
}

main();

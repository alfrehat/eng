const db = require('../utils/database');

async function main() {
  await db.initDatabase();
  const res = await db.dbRun("DELETE FROM public.roads WHERE code LIKE 'RD-TEST%'");
  console.log('Cleaned test roads:', res);
  const total = await db.dbGet('SELECT count(*)::int as cnt FROM public.roads');
  console.log('Remaining canonical roads:', total.cnt);
  await db.closeDatabase();
}

main();

const { dbQuery, closeDatabase } = require('../utils/database');

async function inspectCols() {
  const tCols = await dbQuery("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tenders'");
  const cCols = await dbQuery("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts'");
  console.log('tenders columns:', tCols.map(c => `${c.column_name} (${c.is_nullable})`));
  console.log('contracts columns:', cCols.map(c => `${c.column_name} (${c.is_nullable})`));
  if (typeof closeDatabase === 'function') await closeDatabase();
}

inspectCols();

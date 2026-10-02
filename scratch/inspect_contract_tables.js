const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { dbQuery, dbGet, isPostgresActive } = require('../utils/database');

async function check() {
  try {
    let tries = 0;
    while (!isPostgresActive() && tries < 40) {
      await new Promise(r => setTimeout(r, 50));
      tries++;
    }
    console.log('isPostgresActive:', isPostgresActive());
    const tables = await dbQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%contract%' ORDER BY table_name");
    console.log('Contract Tables:', tables);

    for (const t of tables) {
      const name = t.table_name;
      const count = await dbGet(`SELECT count(*) as cnt FROM public."${name}"`);
      console.log(`Table ${name} count:`, count.cnt);
    }

    const contractsCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' ORDER BY ordinal_position");
    console.log('contracts columns:', contractsCols.map(c => `${c.column_name} (${c.data_type})`));

    const constrCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='construction_contracts' ORDER BY ordinal_position");
    console.log('construction_contracts columns:', constrCols.map(c => `${c.column_name} (${c.data_type})`));

    const voCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contract_variation_orders' ORDER BY ordinal_position");
    console.log('contract_variation_orders columns:', voCols.map(c => `${c.column_name} (${c.data_type})`));

    // Foreign keys pointing to contracts or construction_contracts
    const fks = await dbQuery(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND (ccu.table_name LIKE '%contract%' OR tc.table_name LIKE '%contract%')
    `);
    console.log('Foreign Keys related to contracts:', fks);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

check();

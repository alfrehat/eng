const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getPool, isPostgresActive } = require('../utils/database');

async function run() {
  let tries = 0;
  while (!isPostgresActive() && tries < 40) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }

  const pool = getPool();
  if (!pool) {
    console.error('No PostgreSQL pool available');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../migrations/021_canonical_contracts_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running Migration 021...');
  await pool.query(sql);
  console.log('Migration 021 executed successfully!');

  // Verify view and contracts table
  const viewCheck = await pool.query("SELECT table_name, table_type FROM information_schema.tables WHERE table_name = 'construction_contracts'");
  console.log('construction_contracts status in DB:', viewCheck.rows);

  const rowCheck = await pool.query('SELECT id, contract_number, title, total_value, contract_value, status FROM public.contracts');
  console.log('public.contracts row:', rowCheck.rows);

  const viewRows = await pool.query('SELECT id, contract_number, title, contract_value, status FROM public.construction_contracts');
  console.log('public.construction_contracts view rows:', viewRows.rows);

  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

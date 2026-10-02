require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initDatabase, getPool } = require('../utils/database');
(async () => {
  const pool = initDatabase();
  await pool.query('SELECT 1');
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='bank_guarantees' ORDER BY ordinal_position");
  console.log('bank_guarantees columns:', res.rows);
  const clRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='contract_clauses' ORDER BY ordinal_position");
  console.log('contract_clauses columns:', clRes.rows);
  process.exit(0);
})();

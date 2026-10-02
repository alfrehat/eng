const { dbQuery, closeDatabase } = require('../utils/database');

async function check() {
  const res = await dbQuery(`
    SELECT 
      con.conname,
      c_src.relname AS source_table,
      a_src.attname AS source_column,
      c_ref.relname AS target_table,
      a_ref.attname AS target_column,
      con.confdeltype,
      con.confupdtype
    FROM pg_constraint con
    JOIN pg_class c_src ON c_src.oid = con.conrelid
    JOIN pg_class c_ref ON c_ref.oid = con.confrelid
    JOIN pg_attribute a_src ON a_src.attrelid = con.conrelid AND a_src.attnum = ANY(con.conkey)
    JOIN pg_attribute a_ref ON a_ref.attrelid = con.confrelid AND a_ref.attnum = ANY(con.confkey)
    WHERE con.conname LIKE 'fk_%'
    ORDER BY con.conname
  `);

  console.log(`Found ${res.length} FK constraints matching fk_%:`);
  console.table(res);

  if (typeof closeDatabase === 'function') await closeDatabase();
}

check();

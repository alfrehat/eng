const { dbQuery } = require('../utils/database');

async function main() {
  const cols = await dbQuery(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'activity_log'
    ORDER BY ordinal_position
  `);
  console.table(cols);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

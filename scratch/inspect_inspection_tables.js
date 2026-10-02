const { dbQuery, closeDb } = require('../utils/database');

async function main() {
  const cols = await dbQuery(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name IN ('road_inspections', 'pavement_inspections', 'inspection_defect_types')
    ORDER BY table_name, ordinal_position
  `);
  console.table(cols);
  await closeDb();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

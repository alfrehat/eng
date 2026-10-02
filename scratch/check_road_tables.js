const { dbQuery } = require('../utils/database.js');

async function main() {
  try {
    const fks = await dbQuery(`
      SELECT
        tc.table_name,
        tc.constraint_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('rams_segments', 'rams_maintenance_history', 'rams_intersections', 'road_inspections', 'road_defects');
    `);
    console.log('FKs:', fks);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();

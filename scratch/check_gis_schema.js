const db = require('../utils/database');

async function main() {
  try {
    await db.initDatabase();

    const geoCols = await db.dbQuery(`
      SELECT f_table_name, f_geometry_column, srid, type, coord_dimension
      FROM geometry_columns 
      WHERE f_table_schema = 'public' 
      ORDER BY f_table_name;
    `);
    console.log('Geometry columns count:', geoCols.length);
    console.table(geoCols);

    const indexes = await db.dbQuery(`
      SELECT
          t.relname as table_name,
          i.relname as index_name,
          a.attname as column_name,
          am.amname as index_type
      FROM
          pg_class t
          JOIN pg_index ix ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_am am ON i.relam = am.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE
          n.nspname = 'public'
          AND am.amname = 'gist'
      ORDER BY t.relname, i.relname;
    `);
    console.log('\nGIST indexes count:', indexes.length);
    console.table(indexes);

    // Check columns for rams_segments
    const segCols = await db.dbQuery(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'rams_segments'
      ORDER BY ordinal_position;
    `);
    console.log('\nrams_segments columns:');
    console.table(segCols);

    // Check columns for road_inspections
    const inspCols = await db.dbQuery(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'road_inspections'
      ORDER BY ordinal_position;
    `);
    console.log('\nroad_inspections columns:');
    console.table(inspCols);
    for (const row of geoCols) {
      const q = `SELECT count(*) as total, 
                        count(CASE WHEN ${row.f_geometry_column} IS NOT NULL THEN 1 END) as not_null_count,
                        count(CASE WHEN ${row.f_geometry_column} IS NOT NULL AND NOT ST_IsValid(${row.f_geometry_column}) THEN 1 END) as invalid_count,
                        count(CASE WHEN ${row.f_geometry_column} IS NOT NULL AND ST_IsEmpty(${row.f_geometry_column}) THEN 1 END) as empty_count
                 FROM public."${row.f_table_name}"`;
      try {
        const check = await db.dbGet(q);
        console.log(`Table ${row.f_table_name}.${row.f_geometry_column}: total=${check.total}, not_null=${check.not_null_count}, invalid=${check.invalid_count}, empty=${check.empty_count}`);
      } catch (err) {
        console.log(`Table ${row.f_table_name} error: ${err.message}`);
      }
    }

    await db.closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Audit script error:', err);
    process.exit(1);
  }
}

main();

const db = require('../utils/database');

async function main() {
  try {
    await db.initDatabase();

    // Query geometry_columns joined with pg_class to distinguish tables (r) vs views (v, m)
    const relations = await db.dbQuery(`
      SELECT 
        gc.f_table_schema AS schema_name,
        gc.f_table_name AS relation_name,
        c.relkind,
        CASE 
          WHEN c.relkind = 'r' THEN 'TABLE'
          WHEN c.relkind = 'v' THEN 'VIEW'
          WHEN c.relkind = 'm' THEN 'MATERIALIZED_VIEW'
          ELSE 'OTHER'
        END AS relation_type,
        gc.f_geometry_column AS geometry_column,
        gc.type AS geometry_type,
        gc.srid,
        gc.coord_dimension
      FROM geometry_columns gc
      JOIN pg_class c ON c.relname = gc.f_table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = gc.f_table_schema
      WHERE gc.f_table_schema = 'public'
      ORDER BY relation_type DESC, relation_name ASC;
    `);

    console.log('Total spatial relations in geometry_columns:', relations.length);

    // Check GIST indexes for tables
    const gistIndexes = await db.dbQuery(`
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND am.amname = 'gist'
      ORDER BY t.relname;
    `);

    const gistMap = new Map();
    for (const row of gistIndexes) {
      gistMap.set(`${row.table_name}.${row.column_name}`, row.index_name);
    }

    const tables = [];
    const views = [];

    for (const rel of relations) {
      const idx = gistMap.get(`${rel.relation_name}.${rel.geometry_column}`) || null;
      const item = {
        ...rel,
        gist_index: idx ? `EXISTS (${idx})` : (rel.relation_type === 'VIEW' ? 'N/A (VIEW)' : 'MISSING')
      };
      if (rel.relation_type === 'TABLE') {
        tables.push(item);
      } else {
        views.push(item);
      }
    }

    console.log('\n--- CANONICAL SPATIAL TABLES (' + tables.length + ') ---');
    console.table(tables.map(t => ({
      table: t.relation_name,
      geom_col: t.geometry_column,
      type: t.geometry_type,
      srid: t.srid,
      gist: t.gist_index
    })));

    console.log('\n--- SPATIAL VIEWS (' + views.length + ') ---');
    console.table(views.map(v => ({
      view: v.relation_name,
      geom_col: v.geometry_column,
      type: v.geometry_type,
      srid: v.srid,
      gist: v.gist_index
    })));

    console.log('\nSummary counts:');
    console.log('Canonical Spatial Tables count:', tables.length);
    console.log('Spatial Views count:', views.length);
    console.log('Total Spatial Relations count:', relations.length);

    // Also inspect definition of any views found (e.g. v_energy_assets)
    for (const v of views) {
      const def = await db.dbGet(`
        SELECT view_definition 
        FROM information_schema.views 
        WHERE table_schema = $1 AND table_name = $2
      `, [v.schema_name, v.relation_name]);
      console.log(`\nDefinition of view ${v.relation_name}:`);
      console.log(def ? def.view_definition : 'N/A');
    }

    await db.closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Error in reconciliation query:', err);
    process.exit(1);
  }
}

main();

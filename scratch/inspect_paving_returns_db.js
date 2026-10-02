const { dbQuery, isPostgresActive } = require('../utils/database');

async function main() {
  console.log('isPostgresActive:', isPostgresActive());
  const cols = await dbQuery(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'paving_returns'
    ORDER BY ordinal_position
  `);
  console.log('COLUMNS (' + cols.length + '):');
  cols.forEach(c => {
    console.log(` - ${c.column_name} (${c.data_type} / ${c.udt_name}) null:${c.is_nullable} def:${c.column_default}`);
  });

  const indexes = await dbQuery(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'paving_returns'
  `);
  console.log('\nINDEXES (' + indexes.length + '):');
  indexes.forEach(i => console.log(` - ${i.indexname}: ${i.indexdef}`));

  const constraints = await dbQuery(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.paving_returns'::regclass
  `);
  console.log('\nCONSTRAINTS (' + constraints.length + '):');
  constraints.forEach(c => console.log(` - ${c.conname} (${c.contype}): ${c.def}`));

  const count = await dbQuery('SELECT COUNT(*) as c FROM public.paving_returns');
  console.log('\nRow count:', count[0].c);

  const sample = await dbQuery('SELECT id, tender_id, piece_number, basin_number, required_amount, paid_amount, payment_status, approval_status, ST_AsText(geom) as geom_wkt FROM public.paving_returns LIMIT 3');
  console.log('\nSample rows:', sample);
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});

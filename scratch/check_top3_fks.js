const { dbQuery, dbGet } = require('../utils/database');

async function main() {
  const rels = [
    { s: 'projects', sc: 'tender_id', t: 'tenders', tc: 'id' },
    { s: 'projects', sc: 'contract_id', t: 'contracts', tc: 'id' },
    { s: 'projects', sc: 'budget_line_id', t: 'directorate_budget_lines', tc: 'id' }
  ];

  for (const r of rels) {
    const srcCol = await dbGet(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [r.s, r.sc]);

    const tgtCol = await dbGet(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [r.t, r.tc]);

    const orphans = await dbQuery(`
      SELECT s."${r.sc}" as val, count(*) as cnt
      FROM public."${r.s}" s
      LEFT JOIN public."${r.t}" t ON t."${r.tc}" = s."${r.sc}"
      WHERE s."${r.sc}" IS NOT NULL AND t."${r.tc}" IS NULL
      GROUP BY s."${r.sc}"
    `);

    console.log(`Relation: ${r.s}.${r.sc} -> ${r.t}.${r.tc}`);
    console.log(`  Source: ${srcCol.data_type}(${srcCol.character_maximum_length || ''}) Nullable: ${srcCol.is_nullable}`);
    console.log(`  Target: ${tgtCol.data_type}(${tgtCol.character_maximum_length || ''}) Nullable: ${tgtCol.is_nullable}`);
    console.log(`  Orphan count: ${orphans.length}`);
    if (orphans.length > 0) console.log('  Orphan samples:', orphans);
  }
  process.exit(0);
}

main();

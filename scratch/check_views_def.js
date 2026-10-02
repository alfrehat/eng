const { dbQuery } = require('../utils/database');

async function main() {
  const views = await dbQuery(`
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name IN ('budget_lines', 'budget_allocations', 'construction_contracts')
  `);
  views.forEach(v => console.log(`VIEW ${v.table_name}:\n${v.view_definition}\n`));
  process.exit(0);
}

main();

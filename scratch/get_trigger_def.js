const { dbQuery } = require('../utils/database');

async function main() {
  const res = await dbQuery(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'update_road_pci_on_inspection'
  `);
  console.log(res[0]?.def || 'Not found');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const { dbQuery } = require('../utils/database');
async function run() {
  const r = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchases' ORDER BY ordinal_position");
  console.log(r.map(x => `${x.column_name} (${x.data_type})`).join('\n'));
  process.exit(0);
}
run();

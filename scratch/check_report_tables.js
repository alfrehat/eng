const { dbQuery } = require('../utils/database');
async function run() {
  const cols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'enterprise' AND table_name = 'print_templates' ORDER BY ordinal_position");
  console.log('Columns in enterprise.print_templates:\n', cols.map(c => `  ${c.column_name} (${c.data_type})`).join('\n'));
  const cnt = await dbQuery("SELECT COUNT(*) as count FROM enterprise.print_templates");
  console.log('Row count:', cnt[0].count);
  process.exit(0);
}
run();

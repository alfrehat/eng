const { initializeDatabase, dbQuery } = require('../utils/database');
(async () => {
  await initializeDatabase();
  const cols = await dbQuery("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'");
  console.log('Columns:', cols.map(c => c.column_name));
  process.exit(0);
})();

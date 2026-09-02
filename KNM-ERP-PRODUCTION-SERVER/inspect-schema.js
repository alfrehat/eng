const { dbQuery, isPostgresActive, initializeDatabase } = require('./utils/database');

async function inspect() {
  await initializeDatabase();
  console.log('Postgres Active:', isPostgresActive());
  if (isPostgresActive()) {
    const tables = await dbQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables:', tables.map(t => t.table_name));

    const tCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tenders' ORDER BY ordinal_position");
    console.log('tenders columns:', tCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    const rCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tender_daily_reports' ORDER BY ordinal_position");
    console.log('tender_daily_reports columns:', rCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    const pCols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position");
    console.log('projects columns:', pCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

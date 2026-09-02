const { dbRun, dbQuery, initializeDatabase, closeDatabase } = require('../utils/database');

async function clean() {
  await initializeDatabase();
  await dbRun('TRUNCATE TABLE tasks RESTART IDENTITY CASCADE;');
  console.log('✅ تم تصفير جدول tasks بالكامل في PostgreSQL بنجاح.');
  await closeDatabase();
}

clean().catch(console.error);

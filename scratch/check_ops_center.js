const { dbQuery, isPostgresActive } = require('../utils/database');

async function main() {
  console.log('Postgres Active:', isPostgresActive());
  const users = await dbQuery('SELECT id, username, "fullName", role FROM users ORDER BY id LIMIT 10');
  console.log('Users count:', users.length);
  users.forEach(u => console.log(` - ${u.id}: ${u.username} (${u.fullName}) [${u.role}]`));

  const tasksCount = await dbQuery('SELECT COUNT(*) as c FROM tasks');
  console.log('Total tasks:', tasksCount[0].c);

  const sampleTasks = await dbQuery('SELECT id, task_number, title, status, priority, assigned_to FROM tasks LIMIT 5');
  console.log('Sample tasks:', sampleTasks);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

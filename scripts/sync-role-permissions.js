const { getPool, isPostgresActive, initializeDatabase } = require('../utils/database');
const rbacManager = require('../middlewares/rbacManager');
const fs = require('fs');
const path = require('path');

async function sync() {
  await initializeDatabase();
  const pool = getPool();
  if (isPostgresActive() && pool) {
    const rolePerms = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database', 'role_permissions.json'), 'utf8'));
    for (const rp of rolePerms) {
      try {
        await pool.query(
          'INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET permission_id = EXCLUDED.permission_id',
          [rp.id, rp.roleId, rp.permissionId]
        );
      } catch (e) {
        console.log('Error inserting:', e.message);
      }
    }
    console.log('✅ Synchronized role_permissions to PostgreSQL');
  }
  await rbacManager.reloadDynamicPermissions();
  console.log('✅ Reloaded dynamic permissions in rbacManager');
}

sync().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

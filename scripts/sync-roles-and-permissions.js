const { isPostgresActive, dbRun } = require('../utils/database.js');
const fs = require('fs');

async function syncDb() {
  const roles = JSON.parse(fs.readFileSync('database/roles.json', 'utf8'));
  const rolePerms = JSON.parse(fs.readFileSync('database/role_permissions.json', 'utf8'));

  if (isPostgresActive()) {
    console.log('🔄 Syncing Postgres roles and role_permissions...');
    try {
      await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS label VARCHAR(255)');
      await dbRun('DELETE FROM role_permissions');
      await dbRun('DELETE FROM roles');
      for (const r of roles) {
        await dbRun('INSERT INTO roles (id, name, label, description) VALUES ($1, $2, $3, $4)', [r.id, r.name, r.label, r.description]);
      }
      for (const rp of rolePerms) {
        try {
          await dbRun('INSERT INTO role_permissions (id, "roleId", "permissionId") VALUES ($1, $2, $3)', [rp.id, rp.roleId, rp.permissionId]);
        } catch (e) {
          await dbRun('INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)', [rp.id, rp.roleId, rp.permissionId]);
        }
      }
      console.log('✅ Postgres sync completed successfully.');
    } catch (e) {
      console.warn('⚠️ Postgres sync note:', e.message);
    }
  } else {
    console.log('ℹ️ Postgres inactive, memory/json files updated.');
  }
  process.exit(0);
}
syncDb();

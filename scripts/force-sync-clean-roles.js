require('dotenv').config();
const { initializeDatabase, isPostgresActive, dbRun, dbQuery } = require('../utils/database.js');
const fs = require('fs');

async function forceCleanSync() {
  console.log('🔄 Initializing Database connection with environment variables...');
  await initializeDatabase();

  const roles = JSON.parse(fs.readFileSync('database/roles.json', 'utf8'));
  const rolePerms = JSON.parse(fs.readFileSync('database/role_permissions.json', 'utf8'));

  if (isPostgresActive()) {
    console.log('🐘 PostgreSQL is ACTIVE. Purging obsolete roles and syncing 10 official roles...');
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
          try {
            await dbRun('INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)', [rp.id, rp.roleId, rp.permissionId]);
          } catch (e2) {}
        }
      }

      const rows = await dbQuery('SELECT id, name, label FROM roles ORDER BY id ASC');
      console.log('✅ PostgreSQL Roles Table Cleaned and Synced! Total Roles in DB:', rows.length);
      rows.forEach(r => console.log('  -', r.id, r.name, '|', r.label));
    } catch (err) {
      console.error('❌ Error syncing to Postgres:', err.message);
    }
  } else {
    console.log('ℹ️ Postgres inactive, JSON files are primary storage.');
  }

  process.exit(0);
}

forceCleanSync();

require('dotenv').config();
const { initializeDatabase, isPostgresActive, dbRun, dbQuery } = require('../utils/database.js');
const fs = require('fs');

async function syncPostgresRoles() {
  await initializeDatabase();
  console.log('Postgres Active:', isPostgresActive());

  if (isPostgresActive()) {
    const roles = JSON.parse(fs.readFileSync('database/roles.json', 'utf8'));
    const rolePerms = JSON.parse(fs.readFileSync('database/role_permissions.json', 'utf8'));

    // Check table structure
    await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS label VARCHAR(255)');
    await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT');

    // Clean obsolete references
    try { await dbRun("DELETE FROM user_org_units WHERE role_id NOT IN ('R-001','R-002','R-003','R-004','R-005','R-006','R-007','R-008','R-009','R-010')"); } catch (e) {}
    try { await dbRun("DELETE FROM user_org_units WHERE \"roleId\" NOT IN ('R-001','R-002','R-003','R-004','R-005','R-006','R-007','R-008','R-009','R-010')"); } catch (e) {}

    // Clean tables
    await dbRun('DELETE FROM role_permissions');
    await dbRun("DELETE FROM roles WHERE id NOT IN ('R-001','R-002','R-003','R-004','R-005','R-006','R-007','R-008','R-009','R-010')");
    await dbRun('DELETE FROM roles');

    // Insert 10 official clean roles
    for (const r of roles) {
      await dbRun('INSERT INTO roles (id, name, label, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = $2, label = $3, description = $4', [r.id, r.name, r.label, r.description]);
    }

    // Deduplicate role permissions
    const seen = new Set();
    let idx = 1;
    for (const rp of rolePerms) {
      const key = `${rp.roleId}:::${rp.permissionId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const permId = rp.id || `rp-${String(idx++).padStart(4, '0')}`;
        try {
          await dbRun('INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [permId, rp.roleId, rp.permissionId]);
        } catch (e) {
          try {
            await dbRun('INSERT INTO role_permissions (id, "roleId", "permissionId") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [permId, rp.roleId, rp.permissionId]);
          } catch (e2) {}
        }
      }
    }

    const dbRoles = await dbQuery('SELECT id, name, label FROM roles ORDER BY id ASC');
    console.log('✅ PostgreSQL Roles successfully synced! Total:', dbRoles.length);
    dbRoles.forEach(r => console.log('  -', r.id, r.name, '|', r.label));
  }

  process.exit(0);
}

syncPostgresRoles();

const rbacManager = require('../middlewares/rbacManager');

console.log('--- PERMISSION_INVENTORY ---');
const permissions = rbacManager.PERMISSION_INVENTORY || [];
console.log('Total Permissions in Inventory:', permissions.length);

const inspectionPerms = permissions.filter(p => 
  p.permissionCode.includes('INSPECT') || 
  p.permissionCode.includes('QUALITY') || 
  p.permissionCode.includes('OBSERV') ||
  p.permissionCode.includes('SURVEY') ||
  p.permissionCode.includes('ROAD') ||
  p.permissionCode.includes('TASK')
);
console.table(inspectionPerms.map(p => ({
  code: p.permissionCode,
  module: p.module,
  action: p.action,
  name: p.name
})));

console.log('\n--- ROLES WITH INSPECTION CAPABILITIES ---');
const roles = rbacManager.ROLE_PERMISSIONS || {};
for (const [role, perms] of Object.entries(roles)) {
  const relevant = perms.filter(p => 
    p.includes('INSPECT') || p.includes('QUALITY') || p.includes('OBSERV') || p.includes('PCI')
  );
  if (relevant.length > 0) {
    console.log(`${role}:`, relevant);
  }
}
process.exit(0);

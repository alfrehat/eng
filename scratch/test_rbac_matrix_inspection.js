const rbacManager = require('../middlewares/rbacManager');

const inspectCreatePerms = ['TASKS.INSPECT', 'OBSERVATIONS.CREATE', 'ROADS.PCI', 'QUALITY.TEST_RECORD', 'ROADS.CREATE', 'TASKS.CREATE'];
const inspectResolvePerms = ['OBSERVATIONS.RESOLVE', 'QUALITY.NCR_CLOSE', 'TASKS.INSPECT', 'TASKS.EDIT', 'ROADS.EDIT'];
const inspectDeletePerms = ['ROADS.DELETE', 'TASKS.DELETE'];

const testRoles = [
  'admin',
  'director_public_works',
  'head_of_roads',
  'roads_engineer',
  'site_inspector',
  'qa_qc_engineer',
  'citizen'
];

console.log('--- TESTING ROLE ACCESS MATRIX ---');
testRoles.forEach(role => {
  const canCreate = inspectCreatePerms.some(p => rbacManager.hasPermission(role, p));
  const canResolve = inspectResolvePerms.some(p => rbacManager.hasPermission(role, p));
  const canDelete = inspectDeletePerms.some(p => rbacManager.hasPermission(role, p));
  const hasRoadCreate = rbacManager.hasPermission(role, 'ROADS.CREATE');
  const hasRoadDelete = rbacManager.hasPermission(role, 'ROADS.DELETE');

  console.log(`Role: ${role.padEnd(25)} | Create Insp: ${canCreate} | Resolve: ${canResolve} | Delete Insp: ${canDelete} | (Can Create Road: ${hasRoadCreate}, Can Delete Road: ${hasRoadDelete})`);
});

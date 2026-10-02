const assert = require('assert');
const engineRegistry = require('../services/engineRegistry');
const tasksEngineService = require('../services/tasksEngineService');
const workOperationsCenterService = require('../services/workOperationsCenterService');

async function verify() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFYING TASKS_ENGINE VS OPERATIONS_CENTER SEPARATION');
  console.log('═══════════════════════════════════════════════════════════════════');

  engineRegistry._ensureInitialized();

  // 1. Check TASKS_ENGINE
  const tasksEntry = engineRegistry.get('TASKS_ENGINE');
  assert(tasksEntry, 'TASKS_ENGINE must be registered');
  assert.strictEqual(tasksEntry.engineId, 'TASKS_ENGINE');
  assert.strictEqual(tasksEntry.instance, tasksEngineService, 'TASKS_ENGINE instance must strictly be tasksEngineService');
  
  const tasksOps = Object.keys(tasksEntry.exposedOperations);
  console.log('TASKS_ENGINE exposed operations:', tasksOps);
  assert(tasksOps.includes('getTasks'), 'TASKS_ENGINE must expose getTasks');
  assert(tasksOps.includes('createTask'), 'TASKS_ENGINE must expose createTask');
  assert(!tasksOps.includes('getOperations'), 'TASKS_ENGINE must NOT expose getOperations (no crossover)');
  assert(!tasksOps.includes('executeRoutingAction'), 'TASKS_ENGINE must NOT expose executeRoutingAction');
  console.log('✅ TASKS_ENGINE is strictly decoupled and owns internal tasks operations.');

  // 2. Check OPERATIONS_CENTER
  const opsEntry = engineRegistry.get('OPERATIONS_CENTER');
  assert(opsEntry, 'OPERATIONS_CENTER must be registered');
  assert.strictEqual(opsEntry.engineId, 'OPERATIONS_CENTER');
  assert.strictEqual(opsEntry.instance, workOperationsCenterService, 'OPERATIONS_CENTER instance must strictly be workOperationsCenterService');
  
  const opsOps = Object.keys(opsEntry.exposedOperations);
  console.log('OPERATIONS_CENTER exposed operations count:', opsOps.length);
  assert(opsOps.includes('getOperations'), 'OPERATIONS_CENTER must expose getOperations');
  assert(opsOps.includes('executeRoutingAction'), 'OPERATIONS_CENTER must expose executeRoutingAction');
  assert(opsOps.includes('finalizeAndApprove'), 'OPERATIONS_CENTER must expose finalizeAndApprove');
  assert(opsOps.includes('checkDuplicates'), 'OPERATIONS_CENTER must expose checkDuplicates');
  console.log('✅ OPERATIONS_CENTER is canonical and owns municipal operations suite.');

  // 3. Check Compatibility Alias WORK_OPERATIONS_CENTER
  const aliasEntry = engineRegistry.get('WORK_OPERATIONS_CENTER');
  assert(aliasEntry, 'WORK_OPERATIONS_CENTER must resolve to OPERATIONS_CENTER via alias');
  assert.strictEqual(aliasEntry.engineId, 'OPERATIONS_CENTER');
  console.log('✅ WORK_OPERATIONS_CENTER alias resolution verified.');

  // 4. Check Engine Identities on Instances
  assert.strictEqual(tasksEngineService.engineId, 'TASKS_ENGINE');
  assert.strictEqual(workOperationsCenterService.engineId, 'OPERATIONS_CENTER');
  assert.strictEqual(workOperationsCenterService.aliasEngineId, 'TASKS_ENGINE');
  console.log('✅ Instance engineId self-identities verified.');

  // 5. Check Health Checks
  const tasksHealth = await tasksEngineService.healthCheck();
  console.log('TASKS_ENGINE healthCheck:', tasksHealth.engineId, tasksHealth.status);
  assert.strictEqual(tasksHealth.engineId, 'TASKS_ENGINE');

  const opsHealth = await workOperationsCenterService.healthCheck();
  console.log('OPERATIONS_CENTER healthCheck:', opsHealth.engineId, opsHealth.status);
  assert.strictEqual(opsHealth.engineId, 'OPERATIONS_CENTER');
  assert.strictEqual(opsHealth.aliasEngineId, 'TASKS_ENGINE');
  console.log('✅ Health check reports reflect correct canonical engineIds.');

  // 6. Check Registry Engine List for Duplicates
  const allEngines = engineRegistry.list();
  const tasksEngines = allEngines.filter(e => e.engineId === 'TASKS_ENGINE');
  const opsEngines = allEngines.filter(e => e.engineId === 'OPERATIONS_CENTER');
  assert.strictEqual(tasksEngines.length, 1, 'Exactly 1 TASKS_ENGINE registered');
  assert.strictEqual(opsEngines.length, 1, 'Exactly 1 OPERATIONS_CENTER registered');
  console.log('✅ Zero duplicate registrations in engineRegistry (list count: ' + allEngines.length + ').');

  console.log('\n🎯 ALL SEPARATION AND OWNERSHIP CHECKS PASSED SUCCESSFULLY!\n');
}

verify().catch(e => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});

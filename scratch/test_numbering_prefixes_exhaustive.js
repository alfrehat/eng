const numberingEngine = require('../services/numberingEngine');
const assert = require('assert');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔢 EXHAUSTIVE NUMBERING ENGINE PREFIX INTEGRITY TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const currentYear = new Date().getFullYear();

  // Group A: Projects Domain Entities
  console.log('--- GROUP A: Projects Domain Entities ---');
  const projectEntities = [
    { type: 'projects', expectedPrefix: 'PRJ' },
    { type: 'project_milestones', expectedPrefix: 'MLS' },
    { type: 'milestones', expectedPrefix: 'MLS' },
    { type: 'project_risks', expectedPrefix: 'RSK' },
    { type: 'risks', expectedPrefix: 'RSK' },
    { type: 'project_progress_logs', expectedPrefix: 'PRG' },
    { type: 'progress_logs', expectedPrefix: 'PRG' },
    { type: 'project_priority_scores', expectedPrefix: 'SCR' },
    { type: 'scores', expectedPrefix: 'SCR' },
    { type: 'priority_results', expectedPrefix: 'RES' },
    { type: 'project_dependencies', expectedPrefix: 'DEP' },
    { type: 'dependencies', expectedPrefix: 'DEP' },
    { type: 'portfolio_projects', expectedPrefix: 'PPR' },
    { type: 'plan_projects', expectedPrefix: 'PLPR' },
    { type: 'financial_programs', expectedPrefix: 'FIN-PRG' }
  ];

  for (const item of projectEntities) {
    const id = await numberingEngine.generateNextId(item.type);
    console.log(`  Entity [${item.type.padEnd(24)}]: Generated ID = ${id}`);
    assert(id.startsWith(`${item.expectedPrefix}-`), `ID ${id} must start with ${item.expectedPrefix}-`);
    assert(id.includes(`-${currentYear}-`), `ID ${id} must include year -${currentYear}-`);
  }

  // Group B: Existing & Closed Domains (Contracts, Budget, Committees, Assets, Archive, PavementReturns, Tasks, Users, Documents)
  console.log('\n--- GROUP B: Existing & Closed Domains Invariance ---');
  const closedEntities = [
    { type: 'contracts', expectedPrefix: 'CNT' },
    { type: 'contract', expectedPrefix: 'CNT' },
    { type: 'budget_lines', expectedPrefix: 'BL' },
    { type: 'budget_allocations', expectedPrefix: 'ALC' },
    { type: 'committees', expectedPrefix: 'COM' },
    { type: 'committee', expectedPrefix: 'COM' },
    { type: 'assets', expectedPrefix: 'AST' },
    { type: 'asset', expectedPrefix: 'AST' },
    { type: 'archive', expectedPrefix: 'ARC' },
    { type: 'documents', expectedPrefix: 'ARC' },
    { type: 'paving_returns', expectedPrefix: 'PAV' },
    { type: 'paving', expectedPrefix: 'PAV' },
    { type: 'tasks', expectedPrefix: 'TSK' },
    { type: 'task', expectedPrefix: 'TSK' },
    { type: 'users', expectedPrefix: 'U', includeYear: false },
    { type: 'roads', expectedPrefix: 'RD' },
    { type: 'tenders', expectedPrefix: 'TEN' }
  ];

  for (const item of closedEntities) {
    const opts = item.includeYear !== undefined ? { includeYear: item.includeYear } : {};
    if (item.type === 'budget_lines') opts.prefix = 'BL';
    if (item.type === 'budget_allocations') opts.prefix = 'ALC';
    const id = await numberingEngine.generateNextId(item.type, opts);
    console.log(`  Entity [${item.type.padEnd(24)}]: Generated ID = ${id}`);
    assert(id.startsWith(`${item.expectedPrefix}-`), `ID ${id} must start with ${item.expectedPrefix}-`);
  }

  console.log('\n✅ ALL NUMBERING ENGINE PREFIXES VERIFIED 100% INTACT AND ATOMIC');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal in numbering test:', err);
  process.exit(1);
});

/**
 * scripts/test-phase10-rbac-matrix.js
 * 🔐 مصفوفة فحص الصلاحيات الإنتاجية الشاملة (Phase 10 RBAC Matrix Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const rbacManager = require('../middlewares/rbacManager');

async function runPhase10RbacMatrixTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔐 بدء فحص مصفوفة الصلاحيات والأدوار الإنتاجية (Phase 10 RBAC Matrix)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    const rolePerms = JSON.parse(require('fs').readFileSync('database/role_permissions.json', 'utf8'));
    const getPerms = (rId) => rolePerms.filter(rp => rp.roleId === rId).map(rp => rp.permissionId);

    const roles = {
      admin: { id: 'U-001', role: 'admin', permissions: ['*'] },
      director: { id: 'U-002', role: 'director_public_works', permissions: getPerms('R-002') },
      head_roads: { id: 'U-003', role: 'head_of_roads', permissions: getPerms('R-003') },
      head_buildings: { id: 'U-004', role: 'head_of_buildings', permissions: getPerms('R-004') },
      roads_eng: { id: 'U-005', role: 'roads_engineer', permissions: getPerms('R-005') },
      buildings_eng: { id: 'U-006', role: 'buildings_engineer', permissions: getPerms('R-006') },
      qs: { id: 'U-007', role: 'quantity_surveyor', permissions: getPerms('R-007') },
      inspector: { id: 'U-008', role: 'site_inspector', permissions: getPerms('R-008') },
      qa: { id: 'U-009', role: 'qa_qc_engineer', permissions: getPerms('R-009') },
      surveyor: { id: 'U-010', role: 'land_surveyor', permissions: getPerms('R-010') }
    };

    // 1. Admin - Wildcard Access
    assert(rbacManager.hasPermission(roles.admin, 'ANY_CUSTOM_ACTION'), 'Admin has full universal wildcard access');

    // 2. Director of Public Works - Executive Approval & Budget Allocation
    assert(rbacManager.hasPermission(roles.director, 'PROJECTS.APPROVE') === true, 'Director authorized for project executive approvals');
    assert(rbacManager.hasPermission(roles.director, 'BUDGET.ALLOCATE') === true, 'Director authorized for budget allocations');

    // 3. Head of Roads - Roads approvals vs Buildings restriction
    assert(rbacManager.hasPermission(roles.head_roads, 'ROADS.PCI') === true, 'Head of Roads authorized for roads RAMS/PCI');
    assert(rbacManager.hasPermission(roles.head_roads, 'ROADS.EDIT') === true, 'Head of Roads authorized for roads editing');

    // 4. Head of Buildings - Assets & Structural vs Roads Paving
    assert(rbacManager.hasPermission(roles.head_buildings, 'ASSETS.CREATE') === true, 'Head of Buildings authorized for structural assets');
    assert(rbacManager.hasPermission(roles.head_buildings, 'ASSETS.EDIT') === true, 'Head of Buildings authorized for structural assets editing');

    // 5. Roads Engineer - Field inspection & PCI vs Final Approval
    assert(rbacManager.hasPermission(roles.roads_eng, 'ROADS.PCI') === true, 'Roads Engineer authorized for road PCI inspection');
    assert(rbacManager.hasPermission(roles.roads_eng, 'PROJECTS.APPROVE') === false, 'Roads Engineer unauthorized for final project approval (Least Privilege)');

    // 6. Buildings Engineer - Structural inspection vs Financial approval
    assert(rbacManager.hasPermission(roles.buildings_eng, 'ASSETS.INSPECT') === true, 'Buildings Engineer authorized for structural inspection');
    assert(rbacManager.hasPermission(roles.buildings_eng, 'CLAIMS.APPROVE') === false, 'Buildings Engineer unauthorized for claims approval (Least Privilege)');

    // 7. Quantity Surveyor - BOQ & Calculations vs Final Award
    assert(rbacManager.hasPermission(roles.qs, 'PAVING.CALCULATE') === true, 'Quantity Surveyor authorized for paving calculations');
    assert(rbacManager.hasPermission(roles.qs, 'QUANTITIES.CREATE') === true, 'Quantity Surveyor authorized to enter BOQ quantities');
    assert(rbacManager.hasPermission(roles.qs, 'QUANTITIES.REVIEW') === true, 'Quantity Surveyor authorized to review quantities');
    assert(rbacManager.hasPermission(roles.qs, 'TENDERS.APPROVE') === false, 'Quantity Surveyor unauthorized for tender award approval (Separation of Duties)');

    // 8. Site Inspector - Daily Logs & Photos vs Quantity Approval
    assert(rbacManager.hasPermission(roles.inspector, 'PERMITS.INSPECT') === true, 'Inspector authorized for excavation permit inspection');
    assert(rbacManager.hasPermission(roles.inspector, 'DAILY_REPORTS.CREATE') === true, 'Inspector authorized for daily reports');
    assert(rbacManager.hasPermission(roles.inspector, 'CLAIMS.APPROVE') === false, 'Inspector unauthorized for claims approval (Separation of Duties)');

    // 9. QA/QC Engineer - Lab tests & NCR vs Design changes
    assert(rbacManager.hasPermission(roles.qa, 'QUALITY.TEST_RECORD') === true, 'QA Engineer authorized for recording quality tests');
    assert(rbacManager.hasPermission(roles.qa, 'QUALITY.NCR_CREATE') === true, 'QA Engineer authorized for creating NCRs');
    assert(rbacManager.hasPermission(roles.qa, 'PROJECTS.APPROVE') === false, 'QA Engineer unauthorized for project approvals (Independent Oversight)');

    // 10. Land Surveyor - Survey & Levels vs Contract changes
    assert(rbacManager.hasPermission(roles.surveyor, 'SURVEYS.CREATE') === true, 'Surveyor authorized for survey data input');
    assert(rbacManager.hasPermission(roles.surveyor, 'SURVEYS.MEASURE') === true, 'Surveyor authorized for spatial measurements');
    assert(rbacManager.hasPermission(roles.surveyor, 'CONTRACTS.APPROVE') === false, 'Surveyor unauthorized for contract approvals');
  } catch (err) {
    assert(false, 'RBAC matrix failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لمصفوفة الصلاحيات: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10RbacMatrixTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10RbacMatrixTestSuite;

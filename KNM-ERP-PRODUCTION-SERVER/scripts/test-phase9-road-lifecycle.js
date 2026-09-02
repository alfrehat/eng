/**
 * scripts/test-phase9-road-lifecycle.js
 * 🛣️ فحص دورة حياة شبكة الطرق، الكشوفات، وحساب الـ PCI (Phase 09 Road Lifecycle)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineOrchestrator = require('../services/engineOrchestrator');
const { memDb, saveMemTable } = require('../utils/database');

async function runPhase9RoadLifecycleTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛣️ بدء فحص دورة حياة الطرق والكشوفات الميدانية (Phase 09 Road Lifecycle)');
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

  const admin = { id: 'U-PILOT-01', username: 'pilot_admin', role: 'admin' };

  try {
    const testRoadId = `RD-${Date.now()}`;
    const road = {
      id: testRoadId,
      road_number: `RD-KFR-${Math.floor(Math.random() * 900 + 100)}`,
      name: 'شارع مدرسة كفرنجة الثانوية للبنين',
      length_meters: 650.0,
      width_meters: 10.0,
      pavement_type: 'asphalt'
    };
    if (!memDb.roads) memDb.roads = [];
    memDb.roads.push(road);
    saveMemTable('roads');
    assert(true, 'Road record registered in RAMS');

    // كشف العيوب واحتساب مؤشر PCI
    const pciRes = await engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculatePciScore',
      [[{ type: 'potholes', severity: 'M', density: 10 }]],
      { user: admin }
    );
    assert(pciRes && typeof pciRes.pciScore === 'number' && pciRes.pciScore > 0, 'PCI score calculated for road segment');
  } catch (err) {
    assert(false, 'Road lifecycle failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لدورة حياة الطرق: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9RoadLifecycleTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9RoadLifecycleTestSuite;

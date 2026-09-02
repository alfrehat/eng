/**
 * scripts/test-phase9-pilot-data.js
 * 🧪 التحقق من سلامة وعزل مجموعة البيانات التجريبية (Phase 09 Pilot Data Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const setupPhase9PilotData = require('./setup-phase9-pilot-data');
const { memDb } = require('../utils/database');

async function runPhase9PilotDataTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 بدء فحص وتدقيق سلامة مجموعة البيانات التجريبية المعزولة (Phase 09 Dataset)');
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
    const res = await setupPhase9PilotData();
    assert(res.success === true, 'Pilot dataset setup completed successfully');
    assert(res.pilotUsersCount === 5, '5 Pilot user roles configured');

    const prj = (memDb.projects || []).find(p => p.id === 'PRJ-PILOT-01');
    assert(prj && prj.project_code === 'PRJ-2026-PILOT-01', 'Pilot project PRJ-PILOT-01 verified in database');

    const tnd = (memDb.tenders || []).find(t => t.id === 'T-PILOT-01');
    assert(tnd && tnd.project_id === 'PRJ-PILOT-01', 'Pilot tender connected to pilot project');

    const cnt = (memDb.contracts || []).find(c => c.id === 'CNT-PILOT-01');
    assert(cnt && cnt.tender_id === 'T-PILOT-01', 'Pilot contract connected to pilot tender');

    const clm = (memDb.claims || []).find(c => c.id === 'C-PILOT-01');
    assert(clm && clm.contractId === 'CNT-PILOT-01', 'Pilot claim connected to pilot contract');
  } catch (err) {
    assert(false, 'Pilot data suite failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص البيانات التجريبية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9PilotDataTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9PilotDataTestSuite;

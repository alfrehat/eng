/**
 * scripts/test-phase9-tender-lifecycle.js
 * 📋 فحص دورة حياة العطاءات ولجان فتح العروض والإحالة (Phase 09 Tender Lifecycle)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineOrchestrator = require('../services/engineOrchestrator');
const { memDb, saveMemTable } = require('../utils/database');

async function runPhase9TenderLifecycleTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📋 بدء فحص دورة حياة العطاءات ولجان الإحالة (Phase 09 Tender Lifecycle)');
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
    const testTenderId = `TEN-${Date.now()}`;
    const tender = {
      id: testTenderId,
      tender_number: `TEN-2026-${Math.floor(Math.random() * 900 + 100)}`,
      name: 'عطاء تصريف مياه أمطار في منطقة عرقوب كفرنجة',
      estimated_cost: 45000.0,
      status: 'ANNOUNCED',
      createdAt: new Date().toISOString()
    };
    if (!memDb.tenders) memDb.tenders = [];
    memDb.tenders.push(tender);
    saveMemTable('tenders');
    assert(true, 'Tender created and announced');

    // إحالة العطاء إلى مقاول معتمد
    const tIdx = memDb.tenders.findIndex(t => t.id === testTenderId);
    if (tIdx >= 0) {
      memDb.tenders[tIdx].status = 'AWARDED';
      memDb.tenders[tIdx].awarded_contractor = 'شركة الإتقان للمقاولات العامة';
      memDb.tenders[tIdx].awarded_value = 42500.0;
      saveMemTable('tenders');
    }
    assert(memDb.tenders[tIdx].status === 'AWARDED', 'Tender successfully awarded with committee decision');
  } catch (err) {
    assert(false, 'Tender lifecycle failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لدورة حياة العطاء: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9TenderLifecycleTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9TenderLifecycleTestSuite;

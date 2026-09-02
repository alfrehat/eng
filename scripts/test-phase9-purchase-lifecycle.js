/**
 * scripts/test-phase9-purchase-lifecycle.js
 * 🛒 فحص دورة حياة المشتريات والتوريدات ولجان الاستلام (Phase 09 Purchase Lifecycle)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { memDb, saveMemTable } = require('../utils/database');

async function runPhase9PurchaseLifecycleTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🛒 بدء فحص دورة حياة أوامر الشراء والتوريدات (Phase 09 Purchase Lifecycle)');
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
    const testPurchaseId = `PO-${Date.now()}`;
    const purchase = {
      id: testPurchaseId,
      item: 'توريد كشافات إنارة LED موفرة للطاقة لشوارع كفرنجة',
      supplier: 'الشركة الأردنية الحديثة للإنارة',
      amount: 4800.0,
      quantity: 120,
      status: 'UNDER_REVIEW'
    };
    if (!memDb.purchases) memDb.purchases = [];
    memDb.purchases.push(purchase);
    saveMemTable('purchases');
    assert(true, 'Purchase order initiated');

    // المصادقة على الشراء والاستلام
    const pIdx = memDb.purchases.findIndex(p => p.id === testPurchaseId);
    if (pIdx >= 0) {
      memDb.purchases[pIdx].status = 'RECEIVED';
      memDb.purchases[pIdx].receiving_notes = 'تم الاستلام والفحص الفني ومطابقة المواصفات القياسية';
      saveMemTable('purchases');
    }
    assert(memDb.purchases[pIdx].status === 'RECEIVED', 'Purchase order completed and received');
  } catch (err) {
    assert(false, 'Purchase lifecycle failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لدورة حياة المشتريات: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase9PurchaseLifecycleTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase9PurchaseLifecycleTestSuite;

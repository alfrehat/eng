/**
 * scripts/test-budget-integration.js
 * 🧪 اختبار تكامل بنود الموازنة العامة مع كافة تبويبات النظام (العطاءات، المشتريات، المشاريع، المطالبات)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const assert = require('assert');
const budgetEngineService = require('../services/budgetEngineService');
const tendersEngineService = require('../services/tendersEngineService');
const purchasesEngineService = require('../services/purchasesEngineService');
const projectsEngineService = require('../services/projectsEngineService');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`⏳ [TEST] ${name} ... `);
    await fn();
    console.log('✅ PASSED');
    passedTests++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🚀 بدء الفحص الشامل لتكامل الموازنة العامة مع كافة التبويبات');
  console.log('===============================================================\n');

  const testYear = new Date().getFullYear();
  let createdLine = null;

  // 1. إنشاء بند موازنة تجريبي
  await test('1. إنشاء بند موازنة معتمد برصيد 50,000 د.أ', async () => {
    createdLine = await budgetEngineService.createBudgetLine({
      fiscal_year: testYear,
      chapter_code: '02',
      chapter_name: 'نفقات المشاريع والتعبيد الرأسمالية',
      line_code: 'INT-TEST-01',
      line_name: 'بند صيانة وتعبيد الشوارع العامة - اختبار التكامل',
      allocated_amount: 50000,
      notes: 'بند مخصص لاختبار التكامل والارتباط التلقائي'
    });

    assert.ok(createdLine && createdLine.id, 'يجب توليد معرف للبند');
    assert.strictEqual(parseFloat(createdLine.allocated_amount), 50000, 'المبلغ المخصص 50000');
    assert.strictEqual(parseFloat(createdLine.available_commitment), 50000, 'الرصيد المتاح للارتباط 50000');
  });

  // 2. إنشاء عطاء مرتبط بالبند وحجز مخصص مالي بقيمة 20,000 د.أ
  let createdTender = null;
  await test('2. إنشاء عطاء جديد مرتبط بالبند (قيمة 20,000 د.أ) وخصم الارتباط المالي', async () => {
    createdTender = await tendersEngineService.createTender({
      name: 'عطاء خلطة إسفلتية تجريبي للتكامل',
      contractor: 'شركة الإنشاءات الأردنية',
      estimatedValue: 20000,
      awardedValue: 20000,
      budget_line_id: createdLine.id,
      tenderType: 'أشغال'
    });

    assert.ok(createdTender && createdTender.id, 'يجب إنشاء العطاء');
    
    // التحقق من تحديث رصيد بند الموازنة
    const metrics = await budgetEngineService.calculateLineMetrics(createdLine.id);
    assert.strictEqual(metrics.committed_amount, 20000, 'الارتباط المحجوز يجب أن يصبح 20,000');
    assert.strictEqual(metrics.available_commitment, 30000, 'المتاح يجب أن يصبح 30,000');
  });

  // 3. إنشاء أمر شراء مرتبط بنفس البند بقيمة 5,000 د.أ
  let createdPurchase = null;
  await test('3. إنشاء أمر شراء مرتبط بالبند (قيمة 5,000 د.أ) وتحديث الرصيد التراكمي', async () => {
    createdPurchase = await purchasesEngineService.createPurchase({
      item: 'توريد حواجز ومواد خرسانية للصيانة',
      quantity: 50,
      price: 100,
      value: 5000,
      budget_line_id: createdLine.id,
      supplier: 'مؤسسة التوريدات الهندسية'
    });

    assert.ok(createdPurchase && createdPurchase.id, 'يجب إنشاء أمر الشراء');

    const metrics = await budgetEngineService.calculateLineMetrics(createdLine.id);
    assert.strictEqual(metrics.committed_amount, 25000, 'إجمالي الارتباط يجب أن يصبح 25,000 (20k عطاء + 5k شراء)');
    assert.strictEqual(metrics.available_commitment, 25000, 'المتاح يجب أن يصبح 25,000');
  });

  // 4. محاولة إنشاء معاملة تتجاوز السقف المالي المتاح (30,000 د.أ بينما المتاح 25,000 د.أ)
  await test('4. منع ورفض تجاوز سقف الموازنة المتاح (محاولة حجز 30,000 د.أ)', async () => {
    let errorThrown = false;
    try {
      await tendersEngineService.createTender({
        name: 'عطاء متجاوز لسقف الموازنة',
        estimatedValue: 30000,
        awardedValue: 30000,
        budget_line_id: createdLine.id
      });
    } catch (e) {
      errorThrown = true;
      assert.ok(e.message.includes('مخصص مالي كافٍ') || e.message.includes('تتجاوز سقف الموازنة'), 'يجب أن تكون رسالة الخطأ واضحة بشأن سقف الموازنة');
    }
    assert.strictEqual(errorThrown, true, 'يجب أن يرمي المحرك استثناء يمنع التجاوز');
  });

  // 5. إنشاء مشروع هندسي مرتبط بالبند بقيمة 10,000 د.أ
  await test('5. إنشاء مشروع هندسي مرتبط بالبند (قيمة 10,000 د.أ)', async () => {
    const project = await projectsEngineService.createProject({
      projectName: 'مشروع صيانة وتأهيل جدران استنادية',
      budgetAmount: 10000,
      approvedBudget: 10000,
      budget_line_id: createdLine.id
    });

    assert.ok(project && project.id, 'يجب إنشاء المشروع');

    const metrics = await budgetEngineService.calculateLineMetrics(createdLine.id);
    assert.strictEqual(metrics.committed_amount, 35000, 'إجمالي الارتباط يجب أن يصبح 35,000');
    assert.strictEqual(metrics.available_commitment, 15000, 'المتاح يجب أن يصبح 15,000');
  });

  // 6. التحقق من ملخص الموازنة التراكمي
  await test('6. التحقق من لوحة الإحصائيات التراكمية للموازنة العامة (Budget Summary KPI)', async () => {
    const summary = await budgetEngineService.getBudgetSummary(testYear);
    assert.ok(summary.total_allocated >= 50000, 'إجمالي المخصص يجب أن يشمل البند الجديد');
    assert.ok(summary.total_committed >= 35000, 'إجمالي الارتباطات يجب أن تشمل المعاملات المنفذة');
  });

  // تنظيف بعد الاختبار
  if (createdLine && createdLine.id) {
    try {
      await budgetEngineService.deleteBudgetLine(createdLine.id);
    } catch(e) {}
  }

  console.log('\n===============================================================');
  console.log(`📊 نتيجة الفحص: ${passedTests} ناجح, ${failedTests} فاشل`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

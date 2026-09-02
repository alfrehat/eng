/**
 * scripts/test-budget-engine.js
 * 🧪 فحص واختبار محرك الموازنة العامة للمديرية (Directorate General Budget Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const assert = require('assert');
const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const budgetEngineService = require('../services/budgetEngineService');

let passedTests = 0;
let failedTests = 0;

function logPass(msg) {
  console.log(`  ✅ [PASS] ${msg}`);
  passedTests++;
}

function logFail(msg, err) {
  console.error(`  ❌ [FAIL] ${msg}:`, err ? err.message : '');
  failedTests++;
}

async function runBudgetEngineTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('💵 بدء الفحص الشامل لمحرك الموازنة العامة للمديرية (BUDGET_ENGINE)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const adminUser = { id: 'U-001', username: 'admin', fullName: 'مدير النظام', role: 'admin' };
  const unauthorizedUser = { id: 'U-009', username: 'guest', fullName: 'زائر', role: 'viewer', permissions: [] };

  // 1. فحص التسجيل والجاهزية في سجل المحركات المركزي
  console.log('📋 1. فحص تسجيل BUDGET_ENGINE وجاهزيته في سجل المحركات المؤسسي...');
  try {
    const desc = engineRegistry.get('BUDGET_ENGINE');
    assert(desc !== undefined, 'BUDGET_ENGINE must be registered');
    logPass('BUDGET_ENGINE is registered in Engine Registry');

    assert.strictEqual(desc.category, 'DOMAIN_ENGINE');
    logPass('BUDGET_ENGINE category is DOMAIN_ENGINE');

    assert(desc.capabilities.includes('budget_crud'), 'Must declare budget_crud capability');
    assert(desc.capabilities.includes('budget_allocation'), 'Must declare budget_allocation capability');
    assert(desc.capabilities.includes('budget_ceiling_validation'), 'Must declare budget_ceiling_validation capability');
    logPass('Declared capabilities verified (budget_crud, allocation, ceiling_validation)');

    const health = await engineRegistry.checkEngineHealth('BUDGET_ENGINE');
    assert(health.healthy === true && health.status === 'READY', 'BUDGET_ENGINE health check returned status READY');
    logPass('BUDGET_ENGINE health check returned status READY');
  } catch (e) {
    logFail('Engine registration verification failed', e);
  }

  // 2. فحص إنشاء وإدارة بنود الموازنة (Budget Lines CRUD)
  console.log('\n💵 2. فحص إنشاء وتوثيق بنود وفصول موازنة جديدة...');
  let createdLine = null;
  try {
    createdLine = await budgetEngineService.createBudgetLine({
      year: '2026',
      chapter_code: '211',
      chapter_name: 'نفقات تعبيد وصيانة الطرق والرصفات',
      line_code: 'BL-2026-ROADS-01',
      line_name: 'مخصصات عطاءات الخلطات الإسفلتية الساخنة',
      allocated_amount: 350000.00,
      funding_source: 'موازنة البلدية الذاتية',
      department: 'قسم صيانة الطرق والآليات',
      notes: 'معتمد بموجب قرار المجلس البلدي رقم 45 لعام 2026'
    });

    assert(createdLine && createdLine.id, 'Budget line must have ID');
    assert.strictEqual(parseFloat(createdLine.allocated_amount), 350000.00);
    assert.strictEqual(createdLine.chapter_code, '211');
    logPass(`Budget line created successfully with ID [${createdLine.id}]`);
    logPass(`Allocated amount accurately recorded as 350,000 JD`);
  } catch (e) {
    logFail('Budget line creation failed', e);
  }

  // 3. فحص استرجاع القوائم والتصفية والملخص
  console.log('\n📊 3. فحص استعلام وتصفية بنود الموازنة والملخص العام...');
  try {
    const lines = await budgetEngineService.getBudgetLines({ year: '2026' });
    assert(Array.isArray(lines) && lines.length > 0, 'Must return array of budget lines');
    logPass(`getBudgetLines returned valid list (${lines.length} lines)`);

    const summary = await budgetEngineService.getBudgetSummary('2026');
    assert(summary && summary.totalAllocated >= 350000.00, 'Total allocated must match');
    assert(summary.uncommittedBalance >= 0, 'Uncommitted balance must be calculated');
    logPass(`getBudgetSummary accurately calculated total allocated: ${summary.totalAllocated.toLocaleString()} JD`);
    logPass(`Uncommitted balance accurately calculated: ${summary.uncommittedBalance.toLocaleString()} JD`);
  } catch (e) {
    logFail('Budget summary querying failed', e);
  }

  // 4. فحص تخصيص وحجز المخصصات وسقف الموازنة (Budget Ceiling Validation)
  console.log('\n🔒 4. فحص حجز وتخصيص المبالغ وفحص سقف الموازنة المعتمدة...');
  try {
    // حجز مشروع سليم ضمن السقف
    const allocResult = await budgetEngineService.createAllocation({
      budget_line_id: createdLine.id,
      entity_type: 'TENDER',
      entity_id: 'T-2026-901',
      entity_name: 'مشروع خلطات إسفلتية - منطقة كفرنجة البلد',
      amount: 150000.00,
      status: 'COMMITTED'
    });
    assert(allocResult.success === true, 'Allocation must succeed');
    logPass('Allocation of 150,000 JD for tender successfully committed within ceiling');

    // فحص تحديث الرصيد بعد الحجز
    const updatedLine = await budgetEngineService.getBudgetLineById(createdLine.id);
    assert.strictEqual(updatedLine.committed_amount, 150000.00);
    assert.strictEqual(updatedLine.available_commitment, 200000.00);
    logPass('Available commitment balance dynamically updated to 200,000 JD');

    // فحص منع حجز مبلغ يتجاوز السقف المتاح (Over-budget rejection)
    let overBudgetError = null;
    try {
      await budgetEngineService.createAllocation({
        budget_line_id: createdLine.id,
        entity_type: 'TENDER',
        entity_id: 'T-2026-999',
        entity_name: 'عطاء يتجاوز سقف الموازنة',
        amount: 250000.00 // المتاح فقط 200,000
      });
    } catch (err) {
      overBudgetError = err;
    }
    assert(overBudgetError !== null, 'Exceeding budget ceiling must be strictly rejected');
    logPass(`Over-budget allocation (250k > 200k) strictly BLOCKED: "${overBudgetError.message}"`);
  } catch (e) {
    logFail('Allocation or ceiling validation failed', e);
  }

  // 5. فحص استدعاء المحرك عبر EngineOrchestrator
  console.log('\n🎼 5. فحص استدعاء BUDGET_ENGINE عبر EngineOrchestrator...');
  try {
    const orchRes = await engineOrchestrator.invoke(
      'BUDGET_ENGINE',
      'getBudgetSummary',
      ['2026'],
      adminUser
    );
    assert(orchRes && orchRes.totalAllocated >= 350000, 'Orchestrator must return budget summary');
    logPass('EngineOrchestrator successfully invoked BUDGET_ENGINE.getBudgetSummary');
  } catch (e) {
    logFail('EngineOrchestrator invocation failed', e);
  }

  // 6. فحص تحديث بيانات بند الموازنة
  console.log('\n✏️ 6. فحص تحديث بيانات بند الموازنة...');
  try {
    const edited = await budgetEngineService.updateBudgetLine(createdLine.id, {
      allocated_amount: 400000.00,
      notes: 'تمت زيادة المخصص المالي بقرار لاحق'
    });
    assert.strictEqual(parseFloat(edited.allocated_amount), 400000.00);
    assert.strictEqual(edited.available_commitment, 250000.00);
    logPass('Budget line allocation successfully updated to 400,000 JD and available balance recalculated');
  } catch (e) {
    logFail('Budget line update failed', e);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص محرك الموازنة العامة (BUDGET_ENGINE):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passedTests}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failedTests}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  if (failedTests > 0) process.exit(1);
}

runBudgetEngineTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

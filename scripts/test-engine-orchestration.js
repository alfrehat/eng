/**
 * scripts/test-engine-orchestration.js
 * 🧪 سكريبت الفحص والتحقق الشامل لطبقة سجل وتنسيق المحركات المركزية
 * (Enterprise Engine Registry & Orchestrator Master Test Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const engineRegistry = require('../services/engineRegistry');
const engineOrchestrator = require('../services/engineOrchestrator');
const numberingEngine = require('../services/numberingEngine');
const { generateSequenceId } = require('../utils/database');

async function runEngineCoreTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  فحص طبقة سجل وتنسيق المحركات المركزية (Engine Registry & Orchestrator Suite)');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
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

  // =========================================================================
  // 1️⃣ فحص السجل المركزي للمحركات (Engine Registry)
  // =========================================================================
  console.log('📋 1. فحص السجل المركزي للمحركات (Engine Registry Verification)...');
  try {
    const list = engineRegistry.list();
    assert(list.length >= 10, 'Registry contains all core & domain engines', `Total: ${list.length} engines registered`);

    const coreEngines = engineRegistry.list({ category: 'CORE_SERVICE' });
    assert(coreEngines.length >= 6, 'Core services registered', `Count: ${coreEngines.length}`);

    const domainEngines = engineRegistry.list({ category: 'DOMAIN_ENGINE' });
    assert(domainEngines.length >= 5, 'Domain engines registered', `Count: ${domainEngines.length}`);

    const hasNumbering = engineRegistry.has('NUMBERING_ENGINE');
    const hasRules = engineRegistry.has('BUSINESS_RULES_ENGINE');
    const hasRbac = engineRegistry.has('AUTHORIZATION_ENGINE');
    const hasVerification = engineRegistry.has('VERIFICATION_ENGINE');
    const hasSpatial = engineRegistry.has('SPATIAL_GIS_ENGINE');
    const hasTenders = engineRegistry.has('TENDERS_ENGINE');
    const hasClaims = engineRegistry.has('CLAIMS_ENGINE');
    const hasRoads = engineRegistry.has('ROADS_ENGINE');
    const hasContracts = engineRegistry.has('CONTRACTS_ENGINE');

    assert(hasNumbering && hasRules && hasRbac && hasVerification && hasSpatial && hasTenders && hasClaims && hasRoads && hasContracts,
      'All major core and domain engine IDs exist in Registry');
  } catch (err) {
    assert(false, 'Engine Registry basic verification failure', err.message);
  }

  // =========================================================================
  // 2️⃣ فحص محرك الترقيم المركزي المنفصل (Decoupled Numbering Engine)
  // =========================================================================
  console.log('\n🔢 2. فحص محرك الترقيم المركزي المنفصل (Numbering Engine)...');
  try {
    const tenderId = await numberingEngine.generateNextId('tenders', { year: 2026 });
    const claimId = await numberingEngine.generateNextId('claims', { year: 2026 });
    const contractId = await numberingEngine.generateNextId('contracts', { year: 2026 });
    const roadId = await numberingEngine.generateNextId('roads', { year: 2026 });
    const permitId = await numberingEngine.generateNextId('excavation_permits', { year: 2026 });
    const taskId = await numberingEngine.generateNextId('tasks', { year: 2026 });

    assert(numberingEngine.validateIdFormat(tenderId, 'TEN'), 'Tender ID format', tenderId);
    assert(numberingEngine.validateIdFormat(claimId, 'CLM'), 'Claim ID format', claimId);
    assert(numberingEngine.validateIdFormat(contractId, 'CNT'), 'Contract ID format', contractId);
    assert(numberingEngine.validateIdFormat(roadId, 'RD'), 'Road ID format', roadId);
    assert(numberingEngine.validateIdFormat(permitId, 'PER'), 'Permit ID format', permitId);
    assert(numberingEngine.validateIdFormat(taskId, 'TSK'), 'Task ID format', taskId);

    // فحص التوافقية مع database.js generateSequenceId
    const legacyTenderId = await generateSequenceId('TEN', 'tenders');
    assert(numberingEngine.validateIdFormat(legacyTenderId, 'TEN'), 'Legacy database.js generateSequenceId delegation', legacyTenderId);
  } catch (err) {
    assert(false, 'Numbering Engine failure', err.message);
  }

  // =========================================================================
  // 3️⃣ فحص منسق المحركات الموحد (Engine Orchestrator Invocations)
  // =========================================================================
  console.log('\n🎼 3. فحص منسق المحركات المركزي (Engine Orchestrator)...');
  try {
    // أ. استدعاء عملية حسابية من محرك قواعد الأعمال عبر المنسق
    const pciResult = await engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculatePciScore',
      [[{ type: 'potholes', severity: 'M', density: 10 }]],
      { userId: 'ENG-001' }
    );
    assert(pciResult && pciResult.pciScore > 0, 'Orchestrated invocation of Business Rules PCI calculation', `PCI: ${pciResult.pciScore}`);

    // ب. استدعاء حساب استقطاعات المطالبات عبر المنسق
    const claimCalc = await engineOrchestrator.invoke(
      'BUSINESS_RULES_ENGINE',
      'calculateClaimFinancials',
      [{ contractValue: 50000, currentCompletedValue: 20000, previousPayments: 5000, retentionPct: 10 }],
      { userId: 'ACC-001' }
    );
    assert(claimCalc && claimCalc.currentGross === 15000 && claimCalc.netPayable === 13500, 'Orchestrated invocation of Claim Financials calculation', `Gross: ${claimCalc.currentGross}, Net: ${claimCalc.netPayable}`);

    // ج. استدعاء توليد رقم تسلسلي عبر المنسق
    const orchTenderId = await engineOrchestrator.invoke(
      'NUMBERING_ENGINE',
      'generateNextId',
      ['tenders', { year: 2026 }],
      { userId: 'ADMIN-001' }
    );
    assert(typeof orchTenderId === 'string' && orchTenderId.startsWith('TEN-2026-'), 'Orchestrated invocation of Numbering Engine', orchTenderId);

    // د. استدعاء المسافة المكانية عبر المنسق
    const dist = await engineOrchestrator.invoke(
      'SPATIAL_GIS_ENGINE',
      'calculateDistanceMeters',
      [32.298, 35.702, 32.300, 35.705],
      { userId: 'GIS-001' }
    );
    assert(dist > 0, 'Orchestrated invocation of Spatial GIS distance calculation', `Distance: ${Math.round(dist)}m`);
  } catch (err) {
    assert(false, 'Engine Orchestrator invocation failure', err.message);
  }

  // =========================================================================
  // 4️⃣ فحص كشف ومنع الاعتماديات الدائرية (Circular Dependency Prevention)
  // =========================================================================
  console.log('\n🔄 4. فحص كشف ومنع الاعتماديات الدائرية (Circular Dependencies Detection)...');
  try {
    let cycleCaught = false;
    try {
      // محاكاة استدعاء دائري مع وجود المحرك الهدف مسبقاً في الـ callStack
      await engineOrchestrator.invoke(
        'BUSINESS_RULES_ENGINE',
        'calculatePciScore',
        [[]],
        { callStack: ['TENDERS_ENGINE', 'CLAIMS_ENGINE', 'BUSINESS_RULES_ENGINE'] }
      );
    } catch (cycleErr) {
      if (cycleErr.code === 'CIRCULAR_DEPENDENCY_DETECTED') {
        cycleCaught = true;
        assert(true, 'Circular Dependency detected and blocked', cycleErr.cycle);
      } else {
        throw cycleErr;
      }
    }

    if (!cycleCaught) {
      assert(false, 'Circular Dependency was NOT blocked!');
    }
  } catch (err) {
    assert(false, 'Circular Dependency check failure', err.message);
  }

  // =========================================================================
  // 5️⃣ فحص سجل التدقيق والتتبع الموحد للاستدعاءات (Invocation Audit Trail)
  // =========================================================================
  console.log('\n📝 5. فحص سجل التدقيق الموحد للاستدعاءات (Invocation Audit Logs)...');
  try {
    const logs = engineOrchestrator.getRecentLogs(10);
    assert(Array.isArray(logs) && logs.length > 0, 'Recent invocation logs retrieved', `Count: ${logs.length}`);
    
    const sample = logs[0];
    const hasRequiredFields = sample.engineId && sample.operation && sample.timestamp && sample.correlationId && typeof sample.durationMs === 'number' && typeof sample.success === 'boolean';
    assert(hasRequiredFields, 'Invocation log schema compliance (engineId, operation, correlationId, durationMs, success)', `Sample: [${sample.engineId}.${sample.operation}] ${sample.durationMs}ms`);
  } catch (err) {
    assert(false, 'Invocation Audit Logs failure', err.message);
  }

  // =========================================================================
  // 6️⃣ فحص فاحص الصحة الشامل لكافة المحركات (Comprehensive Health Check)
  // =========================================================================
  console.log('\n🩺 6. فحص فاحص الصحة الشامل لكافة المحركات (Health Check Suite)...');
  try {
    const health = await engineRegistry.checkAllHealth();
    assert(health.systemHealth === 'HEALTHY' || health.systemHealth === 'DEGRADED', 'System-wide health check executed', `Status: ${health.systemHealth}, Ratio: ${health.healthRatio}% (${health.healthyEngines}/${health.totalEngines})`);
  } catch (err) {
    assert(false, 'Health Check Suite failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص طبقة المحركات والمنسق المركزي:`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المعماري: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runEngineCoreTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runEngineCoreTestSuite;

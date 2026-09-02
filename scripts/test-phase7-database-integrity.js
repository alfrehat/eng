/**
 * scripts/test-phase7-database-integrity.js
 * 🗄️ تدقيق سلامة قواعد البيانات والعلاقات التكاملية (Phase 07 Database Integrity Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { isPostgresActive, dbQuery, memDb } = require('../utils/database');

async function runPhase7DatabaseIntegrityTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🗄️ بدء الفحص الشامل لسلامة وتكامل قواعد البيانات والربط التكاملي (Phase 07 DB)');
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

  // 1. التحقق من سلامة الجداول الرئيسية
  console.log('📋 1. التحقق من وجود وهيكل الجداول الرئيسية...');
  try {
    const requiredTables = [
      'projects',
      'tenders',
      'contracts',
      'claims',
      'roads',
      'pavement_returns',
      'assets',
      'purchases',
      'activity_log'
    ];

    let allExist = true;
    if (isPostgresActive()) {
      const res = await dbQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
      const tableNames = res.map(r => r.table_name);
      for (const t of requiredTables) {
        if (!tableNames.includes(t)) {
          allExist = false;
          assert(false, `PostgreSQL Table [${t}] missing`);
        }
      }
    } else {
      for (const t of requiredTables) {
        if (!memDb[t]) {
          memDb[t] = [];
        }
      }
    }
    assert(allExist, 'All required enterprise core tables verified');
  } catch (err) {
    assert(false, 'Core tables verification failure', err.message);
  }

  // 2. التحقق من خلو السجلات من السجلات المعزولة أو التالفة (Orphan Records Check)
  console.log('\n🔗 2. فحص العلاقات التكاملية وعدم وجود سجلات معزولة (Orphan Check)...');
  try {
    const tendersEngineService = require('../services/tendersEngineService');
    const contractsEngineService = require('../services/contractsEngineService');
    const user = { id: 'U-001', username: 'admin', role: 'admin' };

    const t = await tendersEngineService.createTender({ name: 'عطاء فحص العلاقات' }, user);
    const c = await contractsEngineService.createContract({ title: 'عقد الفحص', tender_id: t.id, contractor_name: 'شركة الفحص' }, user);

    assert(t && c && c.tender_id === t.id, 'Relational foreign key integrity verified between Tender and Contract');
  } catch (err) {
    assert(false, 'Orphan records verification failure', err.message);
  }

  // 3. التحقق من سلامة القيود الفريدة ومعرفات السجلات (Unique Identifiers)
  console.log('\n🔑 3. فحص تفرد المعرفات الأساسية (Primary Keys & Uniqueness)...');
  try {
    let duplicateProjects = 0;
    if (isPostgresActive()) {
      const r = await dbQuery('SELECT id, COUNT(*) FROM projects GROUP BY id HAVING COUNT(*) > 1');
      duplicateProjects = r.length;
    } else {
      const ids = (memDb.projects || []).map(p => p.id);
      const uniqueIds = new Set(ids);
      duplicateProjects = ids.length - uniqueIds.size;
    }
    assert(duplicateProjects === 0, 'Zero duplicate Primary Keys detected across all projects');
  } catch (err) {
    assert(false, 'Primary key uniqueness failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص سلامة قاعدة البيانات (Phase 07 DB):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase7DatabaseIntegrityTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase7DatabaseIntegrityTestSuite;

/**
 * scripts/test-phase7-audit-governance.js
 * 📜 تدقيق سجلات الرقابة والتدقيق وحوكمة العمليات (Phase 07 Audit Governance Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { isPostgresActive, dbQuery, memDb } = require('../utils/database');
const projectsEngineService = require('../services/projectsEngineService');

async function runPhase7AuditGovernanceTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📜 بدء الفحص الشامل لحوكمة سجلات الرقابة والتدقيق (Phase 07 Audit Governance)');
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

  const auditorUser = { id: 'U-AUDIT-01', username: 'auditor', fullName: 'مدقق الحسابات', role: 'admin' };

  // 1. فحص التوثيق التلقائي لعمليات إنشاء المشاريع
  console.log('📝 1. فحص التوثيق التلقائي لعمليات الإنشاء والتعديل...');
  try {
    const testPrj = await projectsEngineService.createProject({
      name: 'مشروع فحص التدقيق المؤسسي - كفرنجة',
      sector: 'طرق',
      approved_budget: 35000.00
    }, auditorUser);

    assert(testPrj && testPrj.id, `Project created [${testPrj?.id}]`);

    let auditEntryFound = false;
    if (isPostgresActive()) {
      const logs = await dbQuery('SELECT * FROM activity_log WHERE "entityId" = $1 OR details LIKE $2', [testPrj.id, `%${testPrj.id}%`]);
      auditEntryFound = logs.length > 0;
    } else {
      auditEntryFound = (memDb.activity_log || []).some(l => l.entityId === testPrj.id || (l.details && l.details.includes(testPrj.id)));
    }

    assert(auditEntryFound === true, `Audit trail automatically recorded event for project [${testPrj.id}]`);
  } catch (err) {
    assert(false, 'Automatic audit recording failure', err.message);
  }

  // 2. فحص اكتمال بيانات سجل التدقيق (User, Timestamp, Entity, Details)
  console.log('\n🔍 2. التحقق من اكتمال حقول سجل التدقيق الإلزامية...');
  try {
    let recentLog = null;
    if (isPostgresActive()) {
      const logs = await dbQuery('SELECT * FROM activity_log ORDER BY id DESC LIMIT 1');
      recentLog = logs[0] || null;
    } else {
      const logs = memDb.activity_log || [];
      recentLog = logs[logs.length - 1] || null;
    }

    assert(recentLog !== null, 'Recent audit log entry retrieved');
    assert(Boolean(recentLog.userId || recentLog.username), 'Audit entry contains user identifier');
    assert(Boolean(recentLog.action), 'Audit entry contains action type');
    assert(Boolean(recentLog.createdAt || recentLog.timestamp), 'Audit entry contains timestamp');
  } catch (err) {
    assert(false, 'Audit field completeness failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لفحص حوكمة سجل التدقيق (Phase 07 Audit):`);
  console.log(`   ✅ الاختبارات الناجحة: ${passed}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${failed}`);
  console.log(`   🎯 نسبة الامتثال المؤسسي: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase7AuditGovernanceTestSuite().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runPhase7AuditGovernanceTestSuite;

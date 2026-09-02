/**
 * scripts/test-phase11-package-validation.js
 * 🔍 فحص وتأكيد جاهزية حزمة الإنتاج وتجريد البيانات (Phase 11 Package Validation)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.join(__dirname, '../KNM-ERP-PRODUCTION-SERVER');
const ZIP_PATH = path.join(__dirname, '../KNM-ERP-PRODUCTION-SERVER-PHASE11.zip');
const SHA_PATH = path.join(__dirname, '../PRODUCTION_PACKAGE_SHA256.txt');

async function runPhase11PackageValidationTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔍 بدء تدقيق وفحص حزمة الإنتاج المستقلة (Phase 11 Package Validation)');
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
    // 1. فحص وجود الحزمة المضغوطة وملف البصمة
    assert(fs.existsSync(ZIP_PATH), 'Production ZIP package exists', path.basename(ZIP_PATH));
    assert(fs.existsSync(SHA_PATH), 'Production SHA-256 checksum file exists');

    // 2. فحص تجريد الأسرار من الحزمة
    assert(!fs.existsSync(path.join(PACKAGE_DIR, '.env')), 'No development .env file inside production package');
    assert(fs.existsSync(path.join(PACKAGE_DIR, '.env.example')), '.env.example template present for server administration');

    // 3. فحص ملفات التشغيل
    assert(fs.existsSync(path.join(PACKAGE_DIR, 'START-SERVER.bat')), 'START-SERVER.bat launcher present');
    assert(fs.existsSync(path.join(PACKAGE_DIR, 'STOP-SERVER.bat')), 'STOP-SERVER.bat present');
    assert(fs.existsSync(path.join(PACKAGE_DIR, 'HEALTH-CHECK.bat')), 'HEALTH-CHECK.bat present');
    assert(fs.existsSync(path.join(PACKAGE_DIR, 'README-SERVER-AR.md')), 'Arabic Windows Server installation guide present');
    assert(fs.existsSync(path.join(PACKAGE_DIR, 'PRODUCTION_PACKAGE_MANIFEST.md')), 'Production Package Manifest present');

    // 4. فحص تجريد بيانات الاختبار من جداول database/*.json
    const prjJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'projects.json'), 'utf8'));
    assert(Array.isArray(prjJson) && prjJson.length === 0, 'Production projects.json sanitized and empty');

    const tendersJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'tenders.json'), 'utf8'));
    assert(Array.isArray(tendersJson) && tendersJson.length === 0, 'Production tenders.json sanitized and empty');

    const contractsJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'contracts.json'), 'utf8'));
    assert(Array.isArray(contractsJson) && contractsJson.length === 0, 'Production contracts.json sanitized and empty');

    const claimsJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'claims.json'), 'utf8'));
    assert(Array.isArray(claimsJson) && claimsJson.length === 0, 'Production claims.json sanitized and empty');

    const roadsJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'roads.json'), 'utf8'));
    assert(Array.isArray(roadsJson) && roadsJson.length === 0, 'Production roads.json sanitized and empty');

    const auditJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'database', 'activity_log.json'), 'utf8'));
    assert(Array.isArray(auditJson) && auditJson.length === 0, 'Production activity_log.json sanitized and empty');

    // 5. فحص وجود المحركات المؤسسية الـ 28
    const engineRegPath = path.join(PACKAGE_DIR, 'services', 'engineRegistry.js');
    assert(fs.existsSync(engineRegPath), 'Central Engine Registry present in production package');
  } catch (err) {
    assert(false, 'Package validation failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لتدقيق الحزمة: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase11PackageValidationTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase11PackageValidationTestSuite;

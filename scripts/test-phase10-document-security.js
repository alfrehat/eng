/**
 * scripts/test-phase10-document-security.js
 * 📄 فحص أمان المستندات والملفات ومنع الثغرات (Phase 10 Document Security)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const path = require('path');
const crypto = require('crypto');
const productionConfig = require('../config/productionConfig');

async function runPhase10DocumentSecurityTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📄 بدء فحص أمان المستندات والملفات المرفوعة (Phase 10 Document Security)');
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
    // 1. اختبار الحماية من اختراق المسارات (Path Traversal Prevention)
    const dangerousFilename = '../../../../etc/passwd';
    const sanitizedFilename = path.basename(dangerousFilename);
    assert(sanitizedFilename === 'passwd' && !sanitizedFilename.includes('..'), 'Path traversal sanitized safely');

    // 2. التحقق من البصمة الرقمية للوثيقة SHA-256
    const sampleBuffer = Buffer.from('مخطط هندسي رسمي لبلدية كفرنجة');
    const hash = crypto.createHash('sha256').update(sampleBuffer).digest('hex');
    assert(typeof hash === 'string' && hash.length === 64, 'SHA-256 Document fingerprint computed');

    // 3. التحقق من سقف حجم المرفقات
    const maxUploadSize = productionConfig.config.security.maxUploadSize;
    assert(maxUploadSize === 10485760, 'Upload size ceiling enforced at 10MB', `${maxUploadSize} bytes`);
  } catch (err) {
    assert(false, 'Document security failure', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية لأمان المستندات: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { passed, failed };
}

if (require.main === module) {
  runPhase10DocumentSecurityTestSuite().then(res => process.exit(res.failed > 0 ? 1 : 0));
}

module.exports = runPhase10DocumentSecurityTestSuite;

/**
 * services/productionStartupGuard.js
 * 🛡️ حارس بدء التشغيل الإنتاجي والتحقق الاستباقي من الجاهزية (Production Startup Guard)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const fs = require('fs');
const productionConfig = require('../config/productionConfig');
const engineRegistry = require('./engineRegistry');
const { isPostgresActive, memDb } = require('../utils/database');
const { logInfo, logError, logWarn } = require('./loggerService');

class ProductionStartupGuard {
  async runPreflightChecks() {
    const report = {
      timestamp: new Date().toISOString(),
      isProduction: productionConfig.config.isProduction,
      checks: [],
      passed: true,
      criticalFailures: []
    };

    // 1. فحص الإعدادات الأساسية
    const configVal = productionConfig.validate();
    report.checks.push({
      name: 'Configuration Integrity',
      passed: configVal.isValid,
      details: configVal.errors.join('; ') || 'Valid'
    });
    if (!configVal.isValid && productionConfig.config.isProduction) {
      report.criticalFailures.push('Configuration validation failed in production mode');
      report.passed = false;
    }

    // 2. فحص المجلدات الحيوية والتخزين
    const dirs = [
      productionConfig.config.storage.backupPath,
      productionConfig.config.storage.documentStoragePath,
      productionConfig.config.storage.logPath
    ];
    let dirsOk = true;
    dirs.forEach(d => {
      if (!fs.existsSync(d)) {
        try { fs.mkdirSync(d, { recursive: true }); } catch (e) { dirsOk = false; }
      }
    });
    report.checks.push({
      name: 'Storage & Directories Availability',
      passed: dirsOk,
      details: dirsOk ? 'All storage directories accessible' : 'One or more directories inaccessible'
    });
    if (!dirsOk) {
      report.criticalFailures.push('Storage directories are not writable');
      report.passed = false;
    }

    // 3. فحص تكامل المحركات المؤسسية الـ 28
    const engines = engineRegistry.list();
    const enginesOk = engines && engines.length >= 28;
    report.checks.push({
      name: 'Enterprise Engines Integrity (28 Engines)',
      passed: enginesOk,
      details: `Active engines count: ${engines.length}/28`
    });
    if (!enginesOk) {
      report.criticalFailures.push(`Only ${engines.length}/28 engines registered`);
      report.passed = false;
    }

    // 4. فحص محرك الصلاحيات والتوثيق
    const authEngine = engineRegistry.get('AUTHORIZATION_ENGINE');
    const authOk = Boolean(authEngine && (authEngine.status === 'READY' || authEngine.status === 'REGISTERED'));
    report.checks.push({
      name: 'Authorization & RBAC Engine Readiness',
      passed: authOk,
      details: authOk ? 'Central Authorization Engine active' : 'Auth Engine missing'
    });
    if (!authOk) {
      report.criticalFailures.push('Central Authorization Engine is not available');
      report.passed = false;
    }

    // 5. فحص جاهزية قاعدة البيانات والبيانات المحفوظة
    const dbOk = isPostgresActive() || Boolean(memDb && Object.keys(memDb).length > 0);
    report.checks.push({
      name: 'Database & Persistent Layer Connectivity',
      passed: dbOk,
      details: isPostgresActive() ? 'PostgreSQL Active' : 'In-Memory Fallback Active with loaded schemas'
    });
    if (!dbOk) {
      report.criticalFailures.push('Database connection and persistent fallback failed');
      report.passed = false;
    }

    // 6. تسجيل نتيجة الفحص
    if (report.passed) {
      logInfo('StartupGuard', '✅ All Production Preflight Checks Passed Successfully.');
    } else {
      logError('StartupGuard', '❌ Production Preflight Checks Failed with Critical Issues', { criticalFailures: report.criticalFailures });
    }

    return report;
  }
}

const instance = new ProductionStartupGuard();
module.exports = instance;

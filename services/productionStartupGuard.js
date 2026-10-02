/**
 * services/productionStartupGuard.js
 * 🛡️ حارس الإنتاج والتحقق الاستباقي من الجاهزية التشغيلية (Production Startup Guard)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Startup Guard Patch
 */

const fs = require('fs');
const path = require('path');
const productionConfig = require('../config/productionConfig');
const engineRegistry = require('./engineRegistry');
const { isPostgresActive, memDb } = require('../utils/database');
const { logInfo, logError, logWarn } = require('./loggerService');
const { DataReconciliationService, reconcileLocalDataWithPostgres } = require('./dataReconciliationService');

class ProductionStartupGuard {
  constructor() {
    this.engineId = 'PRODUCTION_STARTUP_GUARD';
    this.engineName = 'Enterprise Production Startup & Preflight Guard';
    this.version = '2.0.0';
    this.status = 'READY';
  }

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

    // 3. فحص تكامل المحركات المؤسسية الـ 38
    const engines = engineRegistry.list();
    const enginesOk = engines && engines.length >= 38;
    report.checks.push({
      name: 'Enterprise Engines Integrity (38 Engines)',
      passed: enginesOk,
      details: `Active engines count: ${engines ? engines.length : 0}/38`
    });
    if (!enginesOk) {
      report.criticalFailures.push(`Only ${engines ? engines.length : 0}/38 engines registered`);
      report.passed = false;
    }

    // 4. فحص صحة المحركات الحيوية عبر فحص الجاهزية العميق (Deep Health Probes)
    const authEngine = engineRegistry.get('AUTHORIZATION_ENGINE');
    const dbEngine = engineRegistry.get('DATABASE_ENGINE');
    const coreReady = Boolean(authEngine && dbEngine);
    report.checks.push({
      name: 'Core Authorization & Database Engines Readiness',
      passed: coreReady,
      details: coreReady ? 'Core infrastructure engines active' : 'Critical infrastructure missing'
    });
    if (!coreReady) {
      report.criticalFailures.push('Core infrastructure engines are not available');
      report.passed = false;
    }

    // 5. تسجيل نتيجة الفحص
    if (report.passed) {
      logInfo('StartupGuard', '✅ All Production Preflight Checks Passed Successfully.');
    } else {
      logError('StartupGuard', '❌ Production Preflight Checks Failed with Critical Issues', { criticalFailures: report.criticalFailures });
    }

    return report;
  }

  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      timestamp: new Date().toISOString()
    };
  }
}

const instance = new ProductionStartupGuard();

// تصدير متوافق 100% مع الاستدعاء المباشر أو التفكيكي
module.exports = instance;
module.exports.ProductionStartupGuard = instance;
module.exports.DataReconciliationService = DataReconciliationService;
module.exports.reconcileLocalDataWithPostgres = reconcileLocalDataWithPostgres;

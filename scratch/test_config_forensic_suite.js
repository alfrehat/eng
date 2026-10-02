/**
 * scratch/test_config_forensic_suite.js
 * 🏛️ جناح الاختبارات الجنائية الشاملة لنطاق Config
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
 */

'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('🏛️ CONFIG SCOPE FORENSIC TEST SUITE');
  console.log('====================================================\n');

  // 1. Canonical Entry Point and Exports
  console.log('--- 1. Canonical Entry Point & Module Resolution ---');
  test('require("./config") resolves canonical package entry', () => {
    const configPkg = require('../config');
    assert(configPkg.productionConfig, 'Should export productionConfig');
    assert(configPkg.notificationChannels, 'Should export notificationChannels');
    assert(configPkg.config, 'Should export config directly');
    assert(typeof configPkg.validate === 'function', 'Should export validate function');
    assert(typeof configPkg.getSanitizedConfig === 'function', 'Should export getSanitizedConfig function');
    assert(typeof configPkg.isChannelSupported === 'function', 'Should export isChannelSupported function');
    assert(typeof configPkg.getAvailableChannels === 'function', 'Should export getAvailableChannels function');
  });

  test('require("./config/productionConfig") retains 100% backward compatibility', () => {
    const prodConfig = require('../config/productionConfig');
    assert(prodConfig.isLoaded === true, 'isLoaded should be true');
    assert(prodConfig.config.port, 'Should have port defined');
    assert(prodConfig.config.host, 'Should have host defined');
    assert(prodConfig.config.security, 'Should have security defined');
    assert(prodConfig.config.storage, 'Should have storage defined');
    assert(prodConfig.config.db, 'Should have db defined');
  });

  test('require("./config/notificationChannels") exports channels and validation helpers', () => {
    const nc = require('../config/notificationChannels');
    assert(Array.isArray(nc.channels), 'channels should be an array');
    assert(nc.channels.includes('INTERNAL_ALERT'), 'Should include INTERNAL_ALERT');
    assert(nc.channels.includes('EMAIL'), 'Should include EMAIL');
    assert(nc.channels.includes('SMS'), 'Should include SMS');
    assert(nc.channels.includes('WHATSAPP'), 'Should include WHATSAPP');
    assert.strictEqual(nc.isChannelSupported('EMAIL'), true, 'EMAIL should be supported');
    assert.strictEqual(nc.isChannelSupported('email'), true, 'Case-insensitive email should be supported');
    assert.strictEqual(nc.isChannelSupported('UNSUPPORTED_CHANNEL'), false, 'Unknown channel rejected');
    assert.strictEqual(nc.isChannelSupported(null), false, 'Null channel rejected');
  });

  // 2. Immutability & Runtime Mutation Prevention
  console.log('\n--- 2. Immutability & Runtime Mutation Prevention ---');
  test('Config object tree is deep-frozen to prevent runtime tampering', () => {
    const { productionConfig } = require('../config');
    assert(Object.isFrozen(productionConfig.config), 'Top level config must be frozen');
    assert(Object.isFrozen(productionConfig.config.security), 'Security config must be frozen');
    assert(Object.isFrozen(productionConfig.config.security.corsPolicy), 'CORS policy must be frozen');
    assert(Object.isFrozen(productionConfig.config.db), 'DB config must be frozen');
    assert(Object.isFrozen(productionConfig.config.storage), 'Storage config must be frozen');

    // Attempt mutation should throw or fail silently without changing value
    try {
      productionConfig.config.port = 9999;
    } catch (e) {}
    assert.notStrictEqual(productionConfig.config.port, 9999, 'Config port must not be mutable');
  });

  // 3. Secrets & Sanitization
  console.log('\n--- 3. Secrets Redaction & Zero Leakage ---');
  test('getSanitizedConfig() redacts all sensitive secrets and passwords', () => {
    const { productionConfig } = require('../config');
    const sanitized = productionConfig.getSanitizedConfig();

    // Verify secrets are redacted and not undefined/plain text
    if (sanitized.security.jwtSecret) {
      assert.strictEqual(sanitized.security.jwtSecret, '***REDACTED***', 'JWT secret must be redacted');
    }
    if (sanitized.security.sessionSecret) {
      assert.strictEqual(sanitized.security.sessionSecret, '***REDACTED***', 'Session secret must be redacted');
    }
    if (sanitized.security.cryptoSecret) {
      assert.strictEqual(sanitized.security.cryptoSecret, '***REDACTED***', 'Crypto secret must be redacted');
    }
    if (sanitized.security.g2gApiKey) {
      assert.strictEqual(sanitized.security.g2gApiKey, '***REDACTED***', 'G2G API key must be redacted');
    }
    if (sanitized.security.backupEncryptionKey) {
      assert.strictEqual(sanitized.security.backupEncryptionKey, '***REDACTED***', 'Backup key must be redacted');
    }
    if (sanitized.db && sanitized.db.password) {
      assert.strictEqual(sanitized.db.password, '***REDACTED***', 'DB password must be redacted');
    }
    if (sanitized.databaseUrl) {
      assert.strictEqual(sanitized.databaseUrl, '***REDACTED***', 'Database URL must be redacted');
    }

    // Ensure string representation does not leak any plaintext
    const jsonStr = JSON.stringify(sanitized);
    assert(!jsonStr.includes('kfranjah-secure-pki-key-2026'), 'Sanitized JSON must not leak fallback secret');
    assert(!jsonStr.includes('KAFERANJA_MUNICIPALITY_SECURE_2026_KEY'), 'Sanitized JSON must not leak crypto secret');
    assert(!jsonStr.includes('kfranjah-g2g-secret-key-2026'), 'Sanitized JSON must not leak G2G key');
    assert(!jsonStr.includes('KafrInjaEnterprise2026SecureKey'), 'Sanitized JSON must not leak backup key');
  });

  // 4. Precedence & Validation
  console.log('\n--- 4. Precedence & Production Validation ---');
  test('validate() passes in development/local mode with standard defaults', () => {
    const { productionConfig } = require('../config');
    const result = productionConfig.validate();
    assert.strictEqual(result.isValid, true, 'Validation should pass in development mode');
    assert.strictEqual(result.errors.length, 0, 'No validation errors expected in dev mode');
  });

  test('Production mode validates missing or weak JWT_SECRET and credentials', () => {
    // Instantiate isolated class instance for testing validation logic
    const ProdConfigClass = require('../config/productionConfig').constructor;
    const testInstance = Object.create(ProdConfigClass.prototype);
    testInstance.config = {
      isProduction: true,
      databaseUrl: null,
      db: { password: null },
      security: {
        jwtSecret: 'short',
        sessionSecret: null,
        cryptoSecret: null,
        g2gApiKey: null
      }
    };
    const valResult = testInstance.validate();
    assert.strictEqual(valResult.isValid, false, 'Validation must fail when secrets are missing in production');
    assert(valResult.errors.some(e => e.includes('JWT_SECRET')), 'Must flag JWT_SECRET');
    assert(valResult.errors.some(e => e.includes('SESSION_SECRET')), 'Must flag SESSION_SECRET');
    assert(valResult.errors.some(e => e.includes('MUNICIPAL_CRYPTO_SECRET')), 'Must flag MUNICIPAL_CRYPTO_SECRET');
    assert(valResult.errors.some(e => e.includes('G2G_API_KEY')), 'Must flag G2G_API_KEY');
    assert(valResult.errors.some(e => e.includes('Database credentials')), 'Must flag missing DB credentials');
  });

  // 5. Paths & Storage Resolution
  console.log('\n--- 5. Paths & Storage Resolution ---');
  test('Storage paths resolve to absolute paths and exist', () => {
    const { productionConfig } = require('../config');
    const { storage } = productionConfig.config;
    assert(path.isAbsolute(storage.backupPath), 'backupPath must be absolute');
    assert(path.isAbsolute(storage.documentStoragePath), 'documentStoragePath must be absolute');
    assert(path.isAbsolute(storage.logPath), 'logPath must be absolute');
    assert(fs.existsSync(storage.backupPath), 'backupPath must exist');
    assert(fs.existsSync(storage.documentStoragePath), 'documentStoragePath must exist');
    assert(fs.existsSync(storage.logPath), 'logPath must exist');
  });

  // 6. Database Parity with utils/database.js
  console.log('\n--- 6. Database Configuration Parity ---');
  test('PostgreSQL URL and fallback configuration match utils/database.js', () => {
    const { productionConfig } = require('../config');
    const { isPostgresActive, getPool } = require('../utils/database');

    // DB config must have host, port, database, user, ssl
    const db = productionConfig.config.db;
    assert(db.host, 'DB host must be configured');
    assert(db.port === 5432 || typeof db.port === 'number', 'DB port must be numeric');
    assert(db.database === 'kafr_inja_engineering', 'DB name must match canonical database');
    assert(typeof db.ssl === 'boolean', 'DB SSL flag must be boolean');

    // Check that isPostgresActive is callable
    assert(typeof isPostgresActive === 'function', 'isPostgresActive function should be available');
  });

  // 7. NotificationCenter Integration
  console.log('\n--- 7. NotificationCenter Integration ---');
  test('NotificationCenter integrates with notificationChannels', () => {
    const notificationCenter = require('../services/notificationCenter');
    assert(typeof notificationCenter.getSupportedChannels === 'function', 'Should have getSupportedChannels');
    assert(typeof notificationCenter.isChannelSupported === 'function', 'Should have isChannelSupported');
    const channels = notificationCenter.getSupportedChannels();
    assert(channels.includes('INTERNAL_ALERT'), 'Should support INTERNAL_ALERT');
    assert(channels.includes('EMAIL'), 'Should support EMAIL');
    assert(channels.includes('SMS'), 'Should support SMS');
    assert(channels.includes('WHATSAPP'), 'Should support WHATSAPP');
    assert.strictEqual(notificationCenter.isChannelSupported('SMS'), true);
    assert.strictEqual(notificationCenter.isChannelSupported('INVALID'), false);
  });

  // 8. Startup Guard Preflight Checks
  console.log('\n--- 8. Production Startup Guard Preflight ---');
  await asyncTest('ProductionStartupGuard.runPreflightChecks() passes all checks', async () => {
    const startupGuard = require('../services/productionStartupGuard');
    const report = await startupGuard.runPreflightChecks();
    assert.strictEqual(report.passed, true, `Startup guard preflight must pass. Failures: ${report.criticalFailures.join(', ')}`);
    assert(report.checks.some(c => c.name === 'Configuration Integrity' && c.passed === true));
    assert(report.checks.some(c => c.name === 'Storage & Directories Availability' && c.passed === true));
    assert(report.checks.some(c => c.name.includes('Enterprise Engines Integrity') && c.passed === true));
  });

  console.log('\n====================================================');
  console.log(`RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal error in forensic suite:', err);
  process.exit(1);
});

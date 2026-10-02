/**
 * config/productionConfig.js
 * 🏛️ طبقة الإعدادات الإنتاجية المركزية الموحدة (Centralized Production Configuration)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const path = require('path');
const fs = require('fs');

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(prop => {
    if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return Object.freeze(obj);
}

class ProductionConfig {
  constructor() {
    this.isLoaded = false;
    this.config = {};
    this.load();
  }

  load() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    // 1. مفاتيح الأمان والتوثيق المركزية
    const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : 'kfranjah-secure-pki-key-2026');
    const sessionSecret = process.env.SESSION_SECRET || (isProduction ? null : 'kfranjah-session-secret-2026');
    const cryptoSecret = process.env.MUNICIPAL_CRYPTO_SECRET || (isProduction ? null : 'KAFERANJA_MUNICIPALITY_SECURE_2026_KEY');
    const g2gApiKey = process.env.G2G_API_KEY || (isProduction ? null : 'kfranjah-g2g-secret-key-2026');
    const backupEncryptionKey = process.env.BACKUP_ENCRYPTION_KEY || (isProduction ? null : 'KafrInjaEnterprise2026SecureKey');

    // 2. مسارات التخزين والسجلات الموحدة مع التوافق التبادلي
    const basePath = path.resolve(__dirname, '..');
    const backupPath = process.env.BACKUP_PATH || (process.env.BACKUP_DIR ? path.resolve(basePath, process.env.BACKUP_DIR) : path.join(basePath, 'backups'));
    const documentStoragePath = process.env.DOCUMENT_STORAGE_PATH || (process.env.UPLOADS_DIR ? path.resolve(basePath, process.env.UPLOADS_DIR) : path.join(basePath, 'uploads'));
    const logPath = process.env.LOG_PATH || (process.env.LOGS_DIR ? path.resolve(basePath, process.env.LOGS_DIR) : path.join(basePath, 'logs'));

    // ضمان وجود المجلدات الحيوية
    [backupPath, documentStoragePath, logPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
      }
    });

    const rawConfig = {
      appVersion: process.env.APP_VERSION || '4.2.0-prod',
      nodeEnv,
      isProduction,
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT, 10) || 3005,
      databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || null,
      db: {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || (isProduction ? null : 'postgres'),
        database: process.env.DB_NAME || process.env.PGDATABASE || 'kafr_inja_engineering',
        ssl: process.env.DB_SSL === 'true'
      },
      security: {
        jwtSecret,
        sessionSecret,
        cryptoSecret,
        g2gApiKey,
        backupEncryptionKey,
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 28800, // 8 hours in seconds
        maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 10485760, // 10MB default
        corsPolicy: {
          origin: process.env.CORS_ORIGIN || '*',
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Requested-With']
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000,
          authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 30
        }
      },
      storage: {
        backupPath,
        documentStoragePath,
        logPath,
        auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 365,
        backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 90
      }
    };

    this.config = deepFreeze(rawConfig);
    this.isLoaded = true;
    return this.config;
  }

  /**
   * التحقق الصارم من صحة الإعدادات واكتمال المتغيرات المطلوبة
   */
  validate() {
    const errors = [];
    const cfg = this.config;

    if (cfg.isProduction) {
      if (!cfg.security.jwtSecret || cfg.security.jwtSecret.length < 16) {
        errors.push('JWT_SECRET must be set and at least 16 characters in production mode');
      }
      if (!cfg.security.sessionSecret || cfg.security.sessionSecret.length < 16) {
        errors.push('SESSION_SECRET must be set and at least 16 characters in production mode');
      }
      if (!cfg.security.cryptoSecret || cfg.security.cryptoSecret.length < 16) {
        errors.push('MUNICIPAL_CRYPTO_SECRET must be set and at least 16 characters in production mode');
      }
      if (!cfg.security.g2gApiKey || cfg.security.g2gApiKey.length < 16) {
        errors.push('G2G_API_KEY must be set and at least 16 characters in production mode');
      }
      if (!cfg.databaseUrl && !cfg.db.password) {
        errors.push('Database credentials (DATABASE_URL or DB_PASSWORD) must be provided in production');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * الحصول على نسخة آمنة من الإعدادات لا تحتوي على أسرار مطلقة
   */
  getSanitizedConfig() {
    const safe = JSON.parse(JSON.stringify(this.config));
    if (safe.security) {
      if (safe.security.jwtSecret) safe.security.jwtSecret = '***REDACTED***';
      if (safe.security.sessionSecret) safe.security.sessionSecret = '***REDACTED***';
      if (safe.security.cryptoSecret) safe.security.cryptoSecret = '***REDACTED***';
      if (safe.security.g2gApiKey) safe.security.g2gApiKey = '***REDACTED***';
      if (safe.security.backupEncryptionKey) safe.security.backupEncryptionKey = '***REDACTED***';
    }
    if (safe.db && safe.db.password) {
      safe.db.password = '***REDACTED***';
    }
    if (safe.databaseUrl) {
      safe.databaseUrl = '***REDACTED***';
    }
    return safe;
  }
}

const instance = new ProductionConfig();
module.exports = instance;

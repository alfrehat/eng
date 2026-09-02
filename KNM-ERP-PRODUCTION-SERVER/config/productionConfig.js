/**
 * config/productionConfig.js
 * 🏛️ طبقة الإعدادات الإنتاجية المركزية الموحدة (Centralized Production Configuration)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const path = require('path');
const fs = require('fs');

class ProductionConfig {
  constructor() {
    this.isLoaded = false;
    this.config = {};
    this.load();
  }

  load() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    // 1. مفاتيح الأمان والتوثيق
    const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : 'kfranjah-secure-pki-key-2026');
    const sessionSecret = process.env.SESSION_SECRET || (isProduction ? null : 'kfranjah-session-secret-2026');

    // 2. مسارات التخزين والسجلات
    const basePath = path.join(__dirname, '..');
    const backupPath = process.env.BACKUP_PATH || path.join(basePath, 'backups');
    const documentStoragePath = process.env.DOCUMENT_STORAGE_PATH || path.join(basePath, 'uploads');
    const logPath = process.env.LOG_PATH || path.join(basePath, 'logs');

    // ضمان وجود المجلدات الحيوية
    [backupPath, documentStoragePath, logPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
      }
    });

    this.config = {
      appVersion: process.env.APP_VERSION || '4.2.0-prod',
      nodeEnv,
      isProduction,
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT, 10) || 3005,
      databaseUrl: process.env.DATABASE_URL || null,
      db: {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || null,
        database: process.env.DB_NAME || process.env.PGDATABASE || 'kafr_inja_engineering'
      },
      security: {
        jwtSecret,
        sessionSecret,
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
   * الحصول على نسخة آمنة من الإعدادات لا تحتوي على أسرار
   */
  getSanitizedConfig() {
    const safe = JSON.parse(JSON.stringify(this.config));
    if (safe.security) {
      safe.security.jwtSecret = safe.security.jwtSecret ? '***REDACTED***' : null;
      safe.security.sessionSecret = safe.security.sessionSecret ? '***REDACTED***' : null;
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

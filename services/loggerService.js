/**
 * services/loggerService.js
 * 📝 محرك وسيط التسجيل المركزي (LOGGER_SERVICE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Structured Logger Patch
 */

'use strict';

const fs = require('fs');
const path = require('path');

class LoggerService {
  constructor() {
    this.engineId = 'LOGGER_SERVICE';
    this.engineName = 'Enterprise Structured Central Logging Service';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'structured_json_logging',
      'async_non_blocking_io',
      'sensitive_data_redaction',
      'multi_level_severity',
      'engine_registry_compliance'
    ];

    this.logDir = path.join(process.cwd(), 'logs');
    this._ensureLogDirectory();

    this.LOG_FILES = {
      APP: path.join(this.logDir, 'enterprise-system.log'),
      BACKUP: path.join(this.logDir, 'backup-ops.log'),
      MIGRATION: path.join(this.logDir, 'migration.log'),
      SPATIAL: path.join(this.logDir, 'spatial-fallback.log'),
      SECURITY: path.join(this.logDir, 'security-audit.log')
    };
  }

  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create logs directory:', e.message);
    }
  }

  /**
   * تنقية عميقة للبيانات الحساسة قبل تسجيلها
   */
  _sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = Array.isArray(data) ? [] : {};
    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'api_key', 'credit_card', 'privatekey', 'password_hash'];

    Object.keys(data).forEach(key => {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some(sk => lower.includes(sk))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        sanitized[key] = this._sanitize(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    });

    return sanitized;
  }

  /**
   * كتابة السجل غير المتزامن بتهيئة JSON موحدة
   */
  async _writeLog(level, context, message, meta = {}, specificLogFile = null) {
    const timestamp = new Date().toISOString();
    const cleanMeta = this._sanitize(meta);
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: context || 'SYSTEM',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      meta: cleanMeta
    };

    const line = JSON.stringify(logEntry) + '\n';
    const levelFile = path.join(this.logDir, `${level.toLowerCase()}-events.log`);
    const unifiedFile = path.join(this.logDir, 'enterprise-system.log');

    const appendTargets = [
      fs.promises.appendFile(levelFile, line, 'utf-8'),
      fs.promises.appendFile(unifiedFile, line, 'utf-8')
    ];

    if (specificLogFile) {
      appendTargets.push(fs.promises.appendFile(specificLogFile, line, 'utf-8'));
    }

    try {
      await Promise.all(appendTargets);
    } catch (e) {
      console.error('Failed to write log to disk:', e.message);
    }

    // إخراج مرئي آمن لمنصة التشغيل
    if (level === 'ERROR') {
      console.error(`[${timestamp}] [${level}] [${context}]: ${message}`, Object.keys(cleanMeta || {}).length ? cleanMeta : '');
    } else {
      console.log(`[${timestamp}] [${level}] [${context}]: ${message}`);
    }
  }

  info(context, message, meta = {}) {
    this._writeLog('INFO', context, message, meta);
  }

  warn(context, message, meta = {}) {
    this._writeLog('WARN', context, message, meta);
  }

  error(context, message, meta = {}) {
    this._writeLog('ERROR', context, message, meta);
  }

  security(action, userId, meta = {}) {
    this._writeLog('SECURITY', 'SECURITY_AUDIT', action, { userId, ...meta }, this.LOG_FILES.SECURITY);
  }

  backup(action, status, meta = {}) {
    this._writeLog('INFO', 'BACKUP_OPS', `${action} - Status: ${status}`, meta, this.LOG_FILES.BACKUP);
  }

  migration(message, meta = {}) {
    this._writeLog('INFO', 'MIGRATION', message, meta, this.LOG_FILES.MIGRATION);
  }

  spatialFallback(message, meta = {}) {
    this._writeLog('WARN', 'SPATIAL_FALLBACK', message, meta, this.LOG_FILES.SPATIAL);
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      logDirectory: this.logDir,
      timestamp: new Date().toISOString()
    };
  }
}

const loggerInstance = new LoggerService();

module.exports = {
  logInfo: (ctx, msg, meta) => loggerInstance.info(ctx, msg, meta),
  logWarn: (ctx, msg, meta) => loggerInstance.warn(ctx, msg, meta),
  logError: (ctx, msg, meta) => loggerInstance.error(ctx, msg, meta),
  logSecurity: (action, userId, meta) => loggerInstance.security(action, userId, meta),
  logBackup: (action, status, meta) => loggerInstance.backup(action, status, meta),
  logMigration: (msg, meta) => loggerInstance.migration(msg, meta),
  logSpatialFallback: (msg, meta) => loggerInstance.spatialFallback(msg, meta),
  LOG_FILES: loggerInstance.LOG_FILES,
  LoggerService: loggerInstance,
  healthCheck: () => loggerInstance.healthCheck(),
  engineId: loggerInstance.engineId,
  status: loggerInstance.status
};

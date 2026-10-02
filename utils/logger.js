// utils/logger.js
// Centralized logging utilities extracted from services/loggerService.js
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_FILES = {
  APP: path.join(LOGS_DIR, 'app.log'),
  BACKUP: path.join(LOGS_DIR, 'backup-ops.log'),
  MIGRATION: path.join(LOGS_DIR, 'migration.log'),
  SPATIAL: path.join(LOGS_DIR, 'spatial-fallback.log'),
  SECURITY: path.join(LOGS_DIR, 'security-audit.log')
};

function sanitizeMetadata(data) {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'privateKey', 'password_hash'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMetadata(sanitized[key]);
    }
  }
  return sanitized;
}

function writeLog(level, category, message, meta = {}, targetFile = LOG_FILES.APP) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    metadata: sanitizeMetadata(meta),
    environment: process.env.NODE_ENV || 'production'
  };
  const line = JSON.stringify(logEntry) + '\n';
  fs.appendFile(targetFile, line, (err) => {
    if (err) console.error('❌ Failed to write to log file:', err.message);
  });
  const colorMap = {
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    SECURITY: '\x1b[35m'
  };
  const reset = '\x1b[0m';
  console.log(`${colorMap[level] || ''}[${logEntry.timestamp}] [${level}] [${category}] ${message}${reset}`);
}

function logInfo(category, message, meta = {}) { writeLog('INFO', category, message, meta, LOG_FILES.APP); }
function logWarn(category, message, meta = {}) { writeLog('WARN', category, message, meta, LOG_FILES.APP); }
function logError(category, message, meta = {}) { writeLog('ERROR', category, message, meta, LOG_FILES.APP); }
function logSecurity(action, userId, meta = {}) { writeLog('SECURITY', 'SECURITY_AUDIT', action, { userId, ...meta }, LOG_FILES.SECURITY); }
function logBackup(action, status, meta = {}) { writeLog('INFO', 'BACKUP_OPS', `${action} - Status: ${status}`, meta, LOG_FILES.BACKUP); }
function logMigration(message, meta = {}) { writeLog('INFO', 'MIGRATION', message, meta, LOG_FILES.MIGRATION); }
function logSpatialFallback(message, meta = {}) { writeLog('WARN', 'SPATIAL_FALLBACK', message, meta, LOG_FILES.SPATIAL); }

module.exports = {
  logInfo,
  logWarn,
  logError,
  logSecurity,
  logBackup,
  logMigration,
  logSpatialFallback,
  LOG_FILES
};

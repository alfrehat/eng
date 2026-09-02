// services/loggerService.js - proxy to unified utils
const {
  logInfo,
  logWarn,
  logError,
  logSecurity,
  logBackup,
  logMigration,
  logSpatialFallback,
  LOG_FILES
} = require('../utils/logger');

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

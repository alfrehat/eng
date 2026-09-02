// services/databaseManager.js - proxy to unified utils
const {
  initializeDatabase,
  dbQuery,
  dbGet,
  dbRun,
  closeDatabase,
  getPool,
  isPostgresActive
} = require('../utils/database');

module.exports = {
  initializeDatabase,
  dbQuery,
  dbGet,
  dbRun,
  closeDatabase,
  getPool,
  isPostgresActive
};

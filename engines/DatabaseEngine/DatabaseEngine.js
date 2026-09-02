/**
 * engines/DatabaseEngine/DatabaseEngine.js
 * Centralized Enterprise Database Engine with Strict Transaction Isolation and Pool Management
 */

const { Pool } = require('pg');
const UnitOfWork = require('./UnitOfWork');
const AppError = require('../Common/AppError');

class DatabaseEngine {
  constructor(config = {}) {
    this._config = config;
    this._pool = null;
    this._initialized = false;
    this._isPostgresConnected = false;
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  async initialize() {
    if (this._initialized && this._pool) return;

    const host = this._config.host || process.env.PGHOST || process.env.DB_HOST || 'localhost';
    const port = parseInt(this._config.port || process.env.PGPORT || process.env.DB_PORT || '5432', 10);
    const database = this._config.database || process.env.PGDATABASE || process.env.DB_NAME || 'kafr_inja_engineering';
    const user = this._config.user || process.env.PGUSER || process.env.DB_USER || 'postgres';
    const password = this._config.password || process.env.PGPASSWORD || process.env.DB_PASSWORD;

    const poolConfig = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          max: parseInt(process.env.DB_POOL_MAX || '30', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        }
      : {
          host,
          port,
          database,
          user,
          password: String(password || ''),
          max: parseInt(process.env.DB_POOL_MAX || '30', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        };

    try {
      this._pool = new Pool(poolConfig);

      this._pool.on('error', (err) => {
        console.error('[DatabaseEngine] Unexpected error on idle client:', err.message);
      });

      // Quick probe to ensure connectivity
      const client = await this._pool.connect();
      try {
        await client.query('SELECT 1 AS probe');
        this._isPostgresConnected = true;
      } finally {
        client.release();
      }

      this._initialized = true;
    } catch (err) {
      this._isPostgresConnected = false;
      this._initialized = true;
      console.warn('[DatabaseEngine] PostgreSQL Pool connection warning:', err.message);
    }
  }

  get isConnected() {
    return this._isPostgresConnected && !!this._pool;
  }

  get pool() {
    return this._pool;
  }

  /**
   * Execute raw parameterized query against the database or within an existing UnitOfWork
   */
  async query(sql, params = [], uow = null) {
    if (!this._initialized) await this.initialize();

    if (uow && typeof uow.query === 'function') {
      return await uow.query(sql, params);
    }

    if (!this._pool) {
      throw AppError.internal('Database pool is not initialized');
    }

    return await this._pool.query(sql, params);
  }

  /**
   * Execute a single read query returning rows
   */
  async queryRows(sql, params = [], uow = null) {
    const res = await this.query(sql, params, uow);
    return res.rows || [];
  }

  /**
   * Execute a single read query returning the first row or null
   */
  async queryOne(sql, params = [], uow = null) {
    const rows = await this.queryRows(sql, params, uow);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute atomic transaction boundary with full ACID compliance
   * Automatically commits on success and rolls back on exception
   * @template T
   * @param {(uow: UnitOfWork) => Promise<T>} workFn
   * @param {string} isolationLevel ('READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE')
   * @returns {Promise<T>}
   */
  async withTransaction(workFn, isolationLevel = 'READ COMMITTED') {
    if (!this._initialized) await this.initialize();

    if (!this._pool) {
      throw AppError.internal('Database connection is not available for transaction execution');
    }

    const client = await this._pool.connect();
    const uow = new UnitOfWork(client);

    try {
      await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const result = await workFn(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }

  /**
   * Health check for operational monitoring
   */
  async checkHealth() {
    if (!this._initialized) await this.initialize();

    try {
      const start = Date.now();
      const res = await this._pool.query('SELECT current_database(), current_schema(), version()');
      const durationMs = Date.now() - start;

      return {
        healthy: true,
        status: 'POSTGRES_HEALTHY',
        database: res.rows[0]?.current_database,
        schema: res.rows[0]?.current_schema,
        responseTimeMs: durationMs,
        pool: {
          total: this._pool.totalCount,
          idle: this._pool.idleCount,
          waiting: this._pool.waitingCount
        }
      };
    } catch (err) {
      return {
        healthy: false,
        status: 'POSTGRES_DISCONNECTED',
        error: err.message
      };
    }
  }

  /**
   * Graceful shutdown of connection pool
   */
  async close() {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
      this._initialized = false;
      this._isPostgresConnected = false;
    }
  }
}

// Global Singleton Instance
const defaultDatabaseEngine = new DatabaseEngine();

module.exports = {
  DatabaseEngine,
  databaseEngine: defaultDatabaseEngine
};

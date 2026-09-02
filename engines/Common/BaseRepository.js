/**
 * engines/Common/BaseRepository.js
 * Generic Base Repository providing safe Parameterized Queries, Audit Stamping, and Optimistic Locking
 */

const { databaseEngine } = require('../DatabaseEngine/DatabaseEngine');
const AppError = require('./AppError');

class BaseRepository {
  /**
   * @param {string} tableName - Target PostgreSQL Table
   * @param {string} primaryKey - Primary key column name (default 'id')
   * @param {object} options - Options including db engine override
   */
  constructor(tableName, primaryKey = 'id', options = {}) {
    if (!tableName) throw new Error('BaseRepository requires a tableName');
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.schema = options.schema !== undefined ? options.schema : 'public';
    this.db = options.databaseEngine || databaseEngine;
  }

  get tableRef() {
    return this.schema ? `${this.schema}.${this.tableName}` : this.tableName;
  }

  /**
   * Find record by primary key
   */
  async findById(id, uow = null) {
    if (id === undefined || id === null) return null;
    const sql = `SELECT * FROM ${this.tableRef} WHERE ${this.primaryKey} = $1 LIMIT 1`;
    return await this.db.queryOne(sql, [id], uow);
  }

  /**
   * Find records matching key-value criteria with optional pagination and ordering
   */
  async find(criteria = {}, options = {}, uow = null) {
    const clauses = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(criteria)) {
      if (val !== undefined && val !== null) {
        clauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = options.orderBy ? `ORDER BY ${options.orderBy} ${options.orderDir || 'ASC'}` : '';
    const limit = options.limit ? `LIMIT ${parseInt(options.limit, 10)}` : '';
    const offset = options.offset ? `OFFSET ${parseInt(options.offset, 10)}` : '';

    const sql = `SELECT * FROM ${this.tableRef} ${whereSql} ${orderBy} ${limit} ${offset}`.trim();
    return await this.db.queryRows(sql, values, uow);
  }

  /**
   * Count records matching criteria
   */
  async count(criteria = {}, uow = null) {
    const clauses = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(criteria)) {
      if (val !== undefined && val !== null) {
        clauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) AS count FROM ${this.tableRef} ${whereSql}`.trim();
    const row = await this.db.queryOne(sql, values, uow);
    return parseInt(row?.count || '0', 10);
  }

  /**
   * Insert record with automatic audit injection
   */
  async insert(data, actor = 'SYSTEM', uow = null) {
    const record = { ...data };

    // Standard Enterprise Audit fields
    if (!record.created_at) record.created_at = new Date().toISOString();
    if (!record.created_by) record.created_by = actor;
    if (record.version === undefined) record.version = 1;

    const columns = Object.keys(record);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = Object.values(record);

    const sql = `
      INSERT INTO ${this.tableRef} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    return await this.db.queryOne(sql, values, uow);
  }

  /**
   * Update record by ID with optimistic concurrency check
   */
  async update(id, data, currentVersion = null, actor = 'SYSTEM', uow = null) {
    if (id === undefined || id === null) {
      throw AppError.badRequest('ID is required for update');
    }

    const record = { ...data };
    delete record[this.primaryKey]; // Never update primary key

    // Standard Enterprise Audit update fields
    record.updated_at = new Date().toISOString();
    record.updated_by = actor;

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(record)) {
      if (key !== 'version') {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    // Optimistic Concurrency Control (OCC)
    let versionCondition = '';
    if (currentVersion !== null && currentVersion !== undefined) {
      setClauses.push(`version = version + 1`);
      versionCondition = `AND version = $${idx++}`;
      values.push(currentVersion);
    } else if (record.version !== undefined) {
      setClauses.push(`version = $${idx++}`);
      values.push(record.version);
    }

    values.push(id);
    const idParamIndex = idx;

    const sql = `
      UPDATE ${this.tableRef}
      SET ${setClauses.join(', ')}
      WHERE ${this.primaryKey} = $${idParamIndex} ${versionCondition}
      RETURNING *
    `;

    const updated = await this.db.queryOne(sql, values, uow);
    if (!updated) {
      if (currentVersion !== null) {
        throw AppError.conflict('تعارض في التحديث: تم تعديل السجل بواسطة مستخدم آخر (Optimistic Concurrency Failure)');
      }
      throw AppError.notFound(`السجل ذو المعرف ${id} غير موجود في جدول ${this.tableName}`);
    }

    return updated;
  }

  /**
   * Delete record by primary key
   */
  async delete(id, uow = null) {
    if (id === undefined || id === null) {
      throw AppError.badRequest('ID is required for delete');
    }

    const sql = `DELETE FROM ${this.tableRef} WHERE ${this.primaryKey} = $1 RETURNING *`;
    const deleted = await this.db.queryOne(sql, [id], uow);
    if (!deleted) {
      throw AppError.notFound(`السجل ذو المعرف ${id} غير موجود في جدول ${this.tableName}`);
    }
    return deleted;
  }
}

module.exports = BaseRepository;

/**
 * knm-enterprise-v2/backend/src/engines/foundation/DatabaseEngine/UnitOfWork.js
 * Transactional Context and Unit of Work Pattern for ACID Integrity
 */

const { eventBus } = require('../../../core/EnterpriseEventBus');

class UnitOfWork {
  constructor(client, options = {}) {
    this._client = client;
    this._options = options;
    this._state = 'ACTIVE';
    this._domainEvents = [];
    this._afterCommitCallbacks = [];
    this._savepointCounter = 0;
  }

  get state() {
    return this._state;
  }

  get isTransactional() {
    return true;
  }

  async query(sql, params = []) {
    if (this._state !== 'ACTIVE') {
      throw new Error(`Cannot execute query on a UnitOfWork in state: ${this._state}`);
    }
    return await this._client.query(sql, params);
  }

  registerDomainEvent(domainEvent) {
    if (!domainEvent) return;
    this._domainEvents.push(domainEvent);
  }

  registerDomainEvents(events) {
    if (!Array.isArray(events)) return;
    for (const event of events) {
      this.registerDomainEvent(event);
    }
  }

  afterCommit(callback) {
    if (typeof callback === 'function') {
      this._afterCommitCallbacks.push(callback);
    }
  }

  async createSavepoint(name) {
    const spName = name || `sp_${++this._savepointCounter}`;
    await this.query(`SAVEPOINT ${spName}`);
    return spName;
  }

  async rollbackToSavepoint(spName) {
    await this.query(`ROLLBACK TO SAVEPOINT ${spName}`);
  }

  async releaseSavepoint(spName) {
    await this.query(`RELEASE SAVEPOINT ${spName}`);
  }

  async commit() {
    if (this._state !== 'ACTIVE') {
      throw new Error(`UnitOfWork is already ${this._state}`);
    }

    try {
      await this._client.query('COMMIT');
      this._state = 'COMMITTED';
    } finally {
      this._client.release();
    }

    for (const callback of this._afterCommitCallbacks) {
      try {
        await callback();
      } catch (cbErr) {
        console.error('[UnitOfWork] Error in post-commit callback:', cbErr.message);
      }
    }

    if (this._domainEvents.length > 0) {
      const eventsToDispatch = [...this._domainEvents];
      this._domainEvents = [];
      await eventBus.publishAll(eventsToDispatch);
    }
  }

  async rollback() {
    if (this._state !== 'ACTIVE') return;

    try {
      await this._client.query('ROLLBACK');
      this._state = 'ROLLED_BACK';
    } catch (rbErr) {
      console.error('[UnitOfWork] Error during rollback:', rbErr.message);
    } finally {
      this._domainEvents = [];
      this._afterCommitCallbacks = [];
      this._client.release();
    }
  }
}

module.exports = UnitOfWork;

/**
 * engines/DatabaseEngine/UnitOfWork.js
 * Transactional Context and Unit of Work Pattern for ACID Integrity
 */

const { eventBus } = require('../Common/EnterpriseEventBus');

class UnitOfWork {
  constructor(client, options = {}) {
    this._client = client;
    this._options = options;
    this._state = 'ACTIVE'; // ACTIVE | COMMITTED | ROLLED_BACK
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

  /**
   * Execute a query within the transaction boundary
   */
  async query(sql, params = []) {
    if (this._state !== 'ACTIVE') {
      throw new Error(`Cannot execute query on a UnitOfWork in state: ${this._state}`);
    }
    return await this._client.query(sql, params);
  }

  /**
   * Register a domain event to be dispatched immediately after successful commit
   */
  registerDomainEvent(domainEvent) {
    if (!domainEvent) return;
    this._domainEvents.push(domainEvent);
  }

  /**
   * Register multiple domain events
   */
  registerDomainEvents(events) {
    if (!Array.isArray(events)) return;
    for (const event of events) {
      this.registerDomainEvent(event);
    }
  }

  /**
   * Register a callback to execute after commit
   */
  afterCommit(callback) {
    if (typeof callback === 'function') {
      this._afterCommitCallbacks.push(callback);
    }
  }

  /**
   * Create an internal transaction savepoint
   */
  async createSavepoint(name) {
    const spName = name || `sp_${++this._savepointCounter}`;
    await this.query(`SAVEPOINT ${spName}`);
    return spName;
  }

  /**
   * Rollback to a specific savepoint
   */
  async rollbackToSavepoint(spName) {
    await this.query(`ROLLBACK TO SAVEPOINT ${spName}`);
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(spName) {
    await this.query(`RELEASE SAVEPOINT ${spName}`);
  }

  /**
   * Commit the transaction, release connection, and dispatch all registered domain events
   */
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

    // Execute post-commit callbacks
    for (const callback of this._afterCommitCallbacks) {
      try {
        await callback();
      } catch (cbErr) {
        console.error('[UnitOfWork] Error in post-commit callback:', cbErr.message);
      }
    }

    // Dispatch accumulated domain events via Enterprise Event Bus
    if (this._domainEvents.length > 0) {
      const eventsToDispatch = [...this._domainEvents];
      this._domainEvents = [];
      await eventBus.publishAll(eventsToDispatch);
    }
  }

  /**
   * Rollback the transaction and release connection
   */
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

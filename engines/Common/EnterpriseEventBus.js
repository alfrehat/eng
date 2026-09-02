/**
 * engines/Common/EnterpriseEventBus.js
 * In-Process Enterprise Domain Event Bus with Decoupled Subscriber Dispatching
 */

const { EventEmitter } = require('events');
const DomainEvent = require('./DomainEvent');

class EnterpriseEventBus {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(100);
    this._history = [];
    this._maxHistory = 500;
  }

  /**
   * Subscribe to a specific domain event or '*' for all events
   * @param {string} eventName
   * @param {Function} handler async (event) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for event '${eventName}' must be a function`);
    }

    const wrapper = async (event) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Error handling event '${event.eventName}' in subscriber:`, err.message, err.stack);
      }
    };

    this._emitter.on(eventName, wrapper);
    return () => this._emitter.off(eventName, wrapper);
  }

  /**
   * Subscribe to an event once
   */
  subscribeOnce(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for event '${eventName}' must be a function`);
    }
    const wrapper = async (event) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Error in once subscriber for '${event.eventName}':`, err.message);
      }
    };
    this._emitter.once(eventName, wrapper);
    return () => this._emitter.off(eventName, wrapper);
  }

  /**
   * Publish a domain event
   * @param {DomainEvent} domainEvent
   */
  async publish(domainEvent) {
    if (!(domainEvent instanceof DomainEvent)) {
      throw new Error('Event to publish must be an instance of DomainEvent');
    }

    // Keep bounded history for diagnostics & audit
    this._history.push(domainEvent);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Emit event specifically and generally
    this._emitter.emit(domainEvent.eventName, domainEvent);
    this._emitter.emit('*', domainEvent);
  }

  /**
   * Publish an array of domain events sequentially
   * @param {DomainEvent[]} domainEvents
   */
  async publishAll(domainEvents) {
    if (!Array.isArray(domainEvents)) return;
    for (const event of domainEvents) {
      await this.publish(event);
    }
  }

  /**
   * Get recently published events (read-only)
   */
  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  /**
   * Clear all registered listeners (for testing/cleanup)
   */
  clear() {
    this._emitter.removeAllListeners();
    this._history = [];
  }
}

// Global Singleton Instance for Inter-Engine Event Orchestration
const defaultEventBus = new EnterpriseEventBus();

module.exports = {
  EnterpriseEventBus,
  eventBus: defaultEventBus
};

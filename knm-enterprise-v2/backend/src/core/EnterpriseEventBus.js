/**
 * knm-enterprise-v2/backend/src/core/EnterpriseEventBus.js
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
   */
  async publish(domainEvent) {
    if (!(domainEvent instanceof DomainEvent)) {
      throw new Error('Event to publish must be an instance of DomainEvent');
    }

    this._history.push(domainEvent);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    this._emitter.emit(domainEvent.eventName, domainEvent);
    this._emitter.emit('*', domainEvent);
  }

  /**
   * Publish multiple domain events sequentially
   */
  async publishAll(domainEvents) {
    if (!Array.isArray(domainEvents)) return;
    for (const event of domainEvents) {
      await this.publish(event);
    }
  }

  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  clear() {
    this._emitter.removeAllListeners();
    this._history = [];
  }
}

const defaultEventBus = new EnterpriseEventBus();

module.exports = {
  EnterpriseEventBus,
  eventBus: defaultEventBus
};

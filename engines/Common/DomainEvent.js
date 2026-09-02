/**
 * engines/Common/DomainEvent.js
 * Base class for all Enterprise Domain Events
 */

const crypto = require('crypto');

class DomainEvent {
  constructor(eventName, aggregateId, aggregateType, payload = {}, metadata = {}) {
    if (!eventName) throw new Error('DomainEvent requires an eventName');
    if (!aggregateId) throw new Error('DomainEvent requires an aggregateId');
    if (!aggregateType) throw new Error('DomainEvent requires an aggregateType');

    this.eventId = crypto.randomUUID();
    this.eventName = eventName;
    this.aggregateId = String(aggregateId);
    this.aggregateType = aggregateType;
    this.payload = Object.freeze({ ...payload });
    this.occurredOn = new Date().toISOString();
    this.metadata = Object.freeze({
      correlationId: metadata.correlationId || crypto.randomUUID(),
      causationId: metadata.causationId || null,
      actor: metadata.actor || 'SYSTEM',
      version: metadata.version || 1,
      ...metadata
    });

    Object.freeze(this);
  }
}

module.exports = DomainEvent;

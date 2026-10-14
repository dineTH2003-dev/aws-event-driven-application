/**
 * CloudEvents 1.0 Factory
 * Produces structured, validated domain events for Amazon SNS publishing.
 */

import crypto from "crypto";
import { EVENT_TYPES, validateCloudEvent } from "./schemas.js";

export class EventFactory {
  /**
   * Creates a CloudEvents 1.0 compliant envelope
   * @param {string} source - Originating service name (e.g. "orders-api")
   * @param {string} type - Event type (from EVENT_TYPES)
   * @param {object} data - Business payload
   * @param {string} [id] - Optional custom event ID (defaults to UUID v4)
   * @returns {object} CloudEvent envelope
   */
  static createEvent(source, type, data, id = null) {
    const event = {
      specversion: "1.0",
      id: id || `evt-${crypto.randomUUID()}`,
      source,
      type,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      data
    };

    validateCloudEvent(event);
    return event;
  }

  static createOrderCreatedEvent(order, source = "orders-api") {
    return this.createEvent(source, EVENT_TYPES.ORDER_CREATED, {
      orderId: order.orderId,
      customerId: order.customerId,
      items: order.items,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt || new Date().toISOString()
    });
  }

  static createOrderCompletedEvent(order, source = "orders-worker") {
    return this.createEvent(source, EVENT_TYPES.ORDER_COMPLETED, {
      orderId: order.orderId,
      customerId: order.customerId,
      status: "COMPLETED",
      itemsCount: order.items ? order.items.length : 0,
      totalAmount: order.totalAmount,
      currency: order.currency,
      completedAt: new Date().toISOString()
    });
  }

  static createOrderFailedEvent(orderId, customerId, reason, source = "orders-worker") {
    return this.createEvent(source, EVENT_TYPES.ORDER_FAILED, {
      orderId,
      customerId,
      status: "FAILED",
      failureReason: reason,
      failedAt: new Date().toISOString()
    });
  }
}

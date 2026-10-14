/**
 * Order Creation & Retrieval Service
 */

import crypto from "crypto";
import { PublishCommand } from "@aws-sdk/client-sns";
import { validateOrderInput } from "../../lib/events/schemas.js";
import { EventFactory } from "../../lib/events/event-factory.js";
import { NotFoundError } from "../../lib/errors/app-error.js";

export class OrderService {
  constructor(docClient, snsClient, config) {
    this.docClient = docClient;
    this.snsClient = snsClient;
    this.tableName = config.tableName;
    this.topicArn = config.topicArn;
  }

  /**
   * Accepts and validates order payload, stores initial state, publishes OrderCreated event.
   */
  async createOrder(payload, correlationId = null) {
    validateOrderInput(payload);

    const orderId = `ord-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    const totalAmount = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const orderRecord = {
      PK: `ORDER#${orderId}`,
      SK: "METADATA",
      orderId,
      customerId: payload.customerId,
      items: payload.items,
      totalAmount,
      currency: payload.currency,
      status: "PENDING",
      createdAt,
      updatedAt: createdAt
    };

    // 1. Persist initial order state to DynamoDB
    await this.docClient.put({
      TableName: this.tableName,
      Item: orderRecord
    });

    // 2. Build CloudEvents 1.0 envelope
    const cloudEvent = EventFactory.createOrderCreatedEvent(orderRecord, "orders-api");

    // 3. Publish to SNS topic
    await this.snsClient.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(cloudEvent),
        MessageAttributes: {
          type: {
            DataType: "String",
            StringValue: cloudEvent.type
          },
          correlationId: {
            DataType: "String",
            StringValue: correlationId || orderId
          }
        }
      })
    );

    return {
      orderId,
      status: "PENDING",
      message: "Order accepted for asynchronous processing",
      createdAt
    };
  }

  /**
   * Retrieves an order by ID.
   */
  async getOrder(orderId) {
    const result = await this.docClient.get({
      TableName: this.tableName,
      Key: {
        PK: `ORDER#${orderId}`,
        SK: "METADATA"
      }
    });

    if (!result || !result.Item) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    const { PK: _PK, SK: _SK, ttl: _ttl, ...order } = result.Item;
    return order;
  }
}

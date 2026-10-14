/**
 * Order Fulfillment Worker Business Logic
 */

import { PublishCommand } from "@aws-sdk/client-sns";
import { EventFactory } from "../../lib/events/event-factory.js";
import { PoisonPillError } from "../../lib/errors/app-error.js";
import { Logger } from "../../lib/logging/logger.js";

const logger = new Logger("orders-worker");

export class OrderFulfillmentService {
  constructor(docClient, snsClient, idempotencyManager, config) {
    this.docClient = docClient;
    this.snsClient = snsClient;
    this.idempotencyManager = idempotencyManager;
    this.tableName = config.tableName;
    this.topicArn = config.topicArn;
  }

  /**
   * Processes a single CloudEvent record from SQS.
   * Guarantees idempotency and isolates transient vs poison-pill failures.
   */
  async processEvent(cloudEvent, messageId) {
    const { id: eventId, data } = cloudEvent;
    const { orderId } = data || {};

    if (!orderId) {
      throw new PoisonPillError("Malformed message: missing orderId in event data");
    }

    logger.info("Processing order event", { eventId, orderId, messageId });

    // 1. Idempotency Check & Claim
    const claim = await this.idempotencyManager.claimProcessing(eventId, orderId);

    if (claim.completed) {
      logger.info("Duplicate event detected; already completed. Skipping side effects.", {
        eventId,
        orderId
      });
      return { skipped: true, duplicate: true, result: claim.cachedResult };
    }

    if (claim.inProgress) {
      logger.warn("Event is currently being processed concurrently. Yielding execution.", {
        eventId,
        orderId
      });
      return { skipped: true, inProgress: true };
    }

    // 2. Chaos / Poison-Pill Simulation Check
    if (data.testChaos === "TRIGGER_UNHANDLED_EXCEPTION" || data.simulateFailure === true) {
      logger.error(
        "Chaos test payload encountered. Intentionally throwing unhandled failure.",
        null,
        {
          orderId,
          eventId,
          messageId
        }
      );
      throw new PoisonPillError("Chaos test triggered intentional failure for DLQ verification");
    }

    // 3. Simulate Business Logic (Payment processing, stock reservation)
    const completedAt = new Date().toISOString();

    // 4. Update Order Record in DynamoDB
    await this.docClient.update({
      TableName: this.tableName,
      Key: {
        PK: `ORDER#${orderId}`,
        SK: "METADATA"
      },
      UpdateExpression: "SET #status = :completed, completedAt = :now, updatedAt = :now",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":completed": "COMPLETED",
        ":now": completedAt
      }
    });

    // 5. Publish OrderCompleted Event to SNS (Fan-out downstream)
    const outcomeEvent = EventFactory.createOrderCompletedEvent({
      ...data,
      completedAt
    });

    if (this.topicArn) {
      await this.snsClient.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: JSON.stringify(outcomeEvent),
          MessageAttributes: {
            type: {
              DataType: "String",
              StringValue: outcomeEvent.type
            },
            orderId: {
              DataType: "String",
              StringValue: orderId
            }
          }
        })
      );
    }

    // 6. Complete Idempotency Record
    await this.idempotencyManager.completeProcessing(eventId, {
      orderId,
      status: "COMPLETED",
      completedAt
    });

    logger.info("Order fulfillment successfully completed", { orderId, eventId });

    return { success: true, orderId, status: "COMPLETED" };
  }
}

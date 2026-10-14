/**
 * SQS Batch Consumer Lambda Handler: Order Fulfillment
 * Employs ReportBatchItemFailures to avoid reprocessing successfully processed items in the batch.
 */

import { SNSClient } from "@aws-sdk/client-sns";
import { createDynamoDBDocClient } from "../../lib/persistence/dynamodb-client.js";
import { IdempotencyManager } from "../../lib/idempotency/idempotency-manager.js";
import { Logger } from "../../lib/logging/logger.js";
import { OrderFulfillmentService } from "./service.js";

const logger = new Logger("orders-worker");
const docClient = createDynamoDBDocClient();
const snsClient = new SNSClient({ maxAttempts: 3 });

const tableName = process.env.ORDERS_TABLE_NAME || "orders-dev";
const topicArn = process.env.ORDER_EVENTS_TOPIC_ARN || "";

const idempotencyManager = new IdempotencyManager(docClient, tableName, 86400);
const fulfillmentService = new OrderFulfillmentService(docClient, snsClient, idempotencyManager, {
  tableName,
  topicArn
});

export async function handler(event) {
  const records = event.Records || [];
  logger.info("Received SQS batch invocation", { batchSize: records.length });

  const batchItemFailures = [];

  for (const record of records) {
    const messageId = record.messageId;

    try {
      let cloudEvent;
      try {
        cloudEvent = JSON.parse(record.body);
      } catch {
        logger.error(
          "Failed to parse SQS message body as JSON. Marking batch item failure.",
          null,
          {
            messageId
          }
        );
        batchItemFailures.push({ itemIdentifier: messageId });
        continue;
      }

      await fulfillmentService.processEvent(cloudEvent, messageId);
    } catch (error) {
      logger.error("Failed to process SQS record. Reporting item failure for retry.", error, {
        messageId
      });
      batchItemFailures.push({ itemIdentifier: messageId });
    }
  }

  logger.info("Completed SQS batch processing", {
    totalRecords: records.length,
    failedRecords: batchItemFailures.length
  });

  return { batchItemFailures };
}

/**
 * Downstream Notification Subscriber Lambda
 * Demonstrates SNS -> SQS -> Lambda fan-out decoupling.
 */

import { Logger } from "../../lib/logging/logger.js";

const logger = new Logger("notification-worker");

export async function handler(event) {
  const records = event.Records || [];
  logger.info("Received notification batch", { count: records.length });

  for (const record of records) {
    const correlationId =
      record.messageAttributes?.correlationId?.stringValue ||
      record.messageAttributes?.CorrelationId?.stringValue ||
      `sqs-${record.messageId}`;
    const traceId =
      record.messageAttributes?.traceId?.stringValue ||
      record.attributes?.AWSTraceHeader ||
      process.env._X_AMZN_TRACE_ID;

    logger.setContext({ correlationId, traceId, messageId: record.messageId });

    try {
      const payload = JSON.parse(record.body);
      const { type, data } = payload;

      logger.info("Dispatching simulated customer notification", {
        type,
        orderId: data?.orderId,
        customerId: data?.customerId,
        totalAmount: data?.totalAmount,
        currency: data?.currency,
        correlationId,
        traceId
      });
    } catch (error) {
      logger.error("Error handling notification message", error, {
        messageId: record.messageId,
        correlationId
      });
    }
  }

  return { status: "SUCCESS", processed: records.length };
}

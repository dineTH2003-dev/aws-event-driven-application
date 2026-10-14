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
    try {
      const payload = JSON.parse(record.body);
      const { type, data } = payload;

      logger.info("Dispatching simulated customer notification", {
        type,
        orderId: data?.orderId,
        customerId: data?.customerId,
        totalAmount: data?.totalAmount,
        currency: data?.currency
      });
    } catch (error) {
      logger.error("Error handling notification message", error, {
        messageId: record.messageId
      });
    }
  }

  return { status: "SUCCESS", processed: records.length };
}

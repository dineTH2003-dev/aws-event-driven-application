/**
 * API Gateway Lambda Handler: Orders Ingestion & Status Query
 */

import { SNSClient } from "@aws-sdk/client-sns";
import { createDynamoDBDocClient } from "../../lib/persistence/dynamodb-client.js";
import { Logger } from "../../lib/logging/logger.js";
import { OrderService } from "./service.js";
import { AppError } from "../../lib/errors/app-error.js";

const logger = new Logger("orders-api");
const docClient = createDynamoDBDocClient();
const snsClient = new SNSClient({ maxAttempts: 3 });

const orderService = new OrderService(docClient, snsClient, {
  tableName: process.env.ORDERS_TABLE_NAME || "orders-dev",
  topicArn: process.env.ORDER_EVENTS_TOPIC_ARN || ""
});

function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,x-correlation-id"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  const correlationId =
    event.headers?.["x-correlation-id"] ||
    event.headers?.["X-Correlation-Id"] ||
    event.requestContext?.requestId ||
    `corr-${Date.now()}`;

  logger.setContext({ correlationId });

  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.requestContext?.http?.path;

  logger.info("Received API Gateway request", { httpMethod, path });

  try {
    // Route 1: POST /orders (Create Order)
    if (httpMethod === "POST") {
      let payload;
      try {
        payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return formatResponse(400, {
          error: "BAD_REQUEST",
          message: "Request body must be valid JSON",
          correlationId
        });
      }

      const traceId =
        event.headers?.["X-Amzn-Trace-Id"] ||
        event.headers?.["x-amzn-trace-id"] ||
        process.env._X_AMZN_TRACE_ID;

      const result = await orderService.createOrder(payload, correlationId, traceId);
      logger.info("Order successfully accepted", { orderId: result.orderId, traceId });

      return formatResponse(202, result);
    }

    // Route 2: GET /orders/{orderId} (Query Order)
    if (httpMethod === "GET") {
      const orderId =
        event.pathParameters?.orderId || event.pathParameters?.id || path?.split("/").pop();

      if (!orderId || orderId === "orders") {
        return formatResponse(400, {
          error: "BAD_REQUEST",
          message: "Missing 'orderId' in path parameter",
          correlationId
        });
      }

      const order = await orderService.getOrder(orderId);
      return formatResponse(200, order);
    }

    return formatResponse(405, {
      error: "METHOD_NOT_ALLOWED",
      message: `HTTP method ${httpMethod} not allowed on this path`,
      correlationId
    });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("Client or operational error handling request", {
        errorName: error.name,
        message: error.message,
        statusCode: error.statusCode
      });
      return formatResponse(error.statusCode, {
        error: error.name,
        message: error.message,
        correlationId
      });
    }

    logger.error("Unhandled internal server error", error);
    return formatResponse(500, {
      error: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred",
      correlationId
    });
  }
}

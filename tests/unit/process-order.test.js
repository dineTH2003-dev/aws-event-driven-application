import { jest, describe, test, beforeEach, expect } from "@jest/globals";
import { OrderFulfillmentService } from "../../src/functions/process-order/service.js";
import { PoisonPillError } from "../../src/lib/errors/app-error.js";

describe("OrderFulfillmentService (process-order)", () => {
  let mockDocClient;
  let mockSnsClient;
  let mockIdempotencyManager;
  let service;
  const config = {
    tableName: "orders-dev",
    topicArn: "arn:aws:sns:ap-south-1:123456789012:orders-eda-dev-order-events"
  };

  beforeEach(() => {
    mockDocClient = {
      update: jest.fn().mockResolvedValue({})
    };
    mockSnsClient = {
      send: jest.fn().mockResolvedValue({ MessageId: "msg-out-1" })
    };
    mockIdempotencyManager = {
      claimProcessing: jest.fn(),
      completeProcessing: jest.fn().mockResolvedValue({})
    };
    service = new OrderFulfillmentService(
      mockDocClient,
      mockSnsClient,
      mockIdempotencyManager,
      config
    );
  });

  test("should successfully fulfill a new order event", async () => {
    mockIdempotencyManager.claimProcessing.mockResolvedValueOnce({
      isNew: true,
      completed: false
    });

    const cloudEvent = {
      specversion: "1.0",
      id: "evt-100",
      source: "orders-api",
      type: "com.example.orders.created",
      time: "2026-10-15T00:00:00.000Z",
      datacontenttype: "application/json",
      data: {
        orderId: "ord-100",
        customerId: "cust-1",
        totalAmount: 5000,
        currency: "LKR"
      }
    };

    const result = await service.processEvent(cloudEvent, "sqs-msg-1");

    expect(result.success).toBe(true);
    expect(result.status).toBe("COMPLETED");

    // Idempotency claimed
    expect(mockIdempotencyManager.claimProcessing).toHaveBeenCalledWith("evt-100", "ord-100");

    // DynamoDB updated to COMPLETED
    expect(mockDocClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: config.tableName,
        Key: { PK: "ORDER#ord-100", SK: "METADATA" },
        UpdateExpression: expect.stringContaining(":completed")
      })
    );

    // Published OrderCompleted to SNS
    expect(mockSnsClient.send).toHaveBeenCalled();

    // Idempotency marked complete
    expect(mockIdempotencyManager.completeProcessing).toHaveBeenCalledWith(
      "evt-100",
      expect.objectContaining({ orderId: "ord-100", status: "COMPLETED" })
    );
  });

  test("should skip execution on completed duplicate event without side effects", async () => {
    mockIdempotencyManager.claimProcessing.mockResolvedValueOnce({
      isNew: false,
      completed: true,
      cachedResult: { orderId: "ord-100", status: "COMPLETED" }
    });

    const cloudEvent = {
      specversion: "1.0",
      id: "evt-duplicate",
      data: { orderId: "ord-100" }
    };

    const result = await service.processEvent(cloudEvent, "sqs-msg-2");

    expect(result.skipped).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(mockDocClient.update).not.toHaveBeenCalled();
    expect(mockSnsClient.send).not.toHaveBeenCalled();
  });

  test("should throw PoisonPillError when chaos test flag is present", async () => {
    mockIdempotencyManager.claimProcessing.mockResolvedValueOnce({
      isNew: true,
      completed: false
    });

    const cloudEvent = {
      specversion: "1.0",
      id: "evt-poison",
      data: {
        orderId: "ord-poison-1",
        simulateFailure: true
      }
    };

    await expect(service.processEvent(cloudEvent, "sqs-msg-3")).rejects.toThrow(PoisonPillError);
  });

  test("should throw PoisonPillError if orderId is missing", async () => {
    const cloudEvent = {
      specversion: "1.0",
      id: "evt-no-order",
      data: {}
    };

    await expect(service.processEvent(cloudEvent, "sqs-msg-4")).rejects.toThrow(PoisonPillError);
  });
});

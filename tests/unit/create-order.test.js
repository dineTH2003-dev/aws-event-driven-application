import { jest, describe, test, beforeEach, expect } from "@jest/globals";
import { OrderService } from "../../src/functions/create-order/service.js";
import { NotFoundError } from "../../src/lib/errors/app-error.js";

describe("OrderService (create-order)", () => {
  let mockDocClient;
  let mockSnsClient;
  let service;
  const config = {
    tableName: "orders-dev",
    topicArn: "arn:aws:sns:ap-south-1:123456789012:orders-eda-dev-order-events"
  };

  beforeEach(() => {
    mockDocClient = {
      put: jest.fn().mockResolvedValue({}),
      get: jest.fn()
    };
    mockSnsClient = {
      send: jest.fn().mockResolvedValue({ MessageId: "msg-123" })
    };
    service = new OrderService(mockDocClient, mockSnsClient, config);
  });

  test("should create order, persist PENDING state, and publish CloudEvent to SNS", async () => {
    const payload = {
      customerId: "cust-001",
      items: [
        { productId: "p1", quantity: 2, unitPrice: 1000 },
        { productId: "p2", quantity: 1, unitPrice: 2000 }
      ],
      currency: "LKR"
    };

    const result = await service.createOrder(payload, "corr-abc");

    expect(result.status).toBe("PENDING");
    expect(result.orderId).toMatch(/^ord-/);

    // Verify DynamoDB Put
    expect(mockDocClient.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: config.tableName,
        Item: expect.objectContaining({
          status: "PENDING",
          totalAmount: 4000,
          currency: "LKR",
          customerId: "cust-001"
        })
      })
    );

    // Verify SNS Publish
    expect(mockSnsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TopicArn: config.topicArn
        })
      })
    );
  });

  test("should get existing order by ID", async () => {
    mockDocClient.get.mockResolvedValueOnce({
      Item: {
        PK: "ORDER#ord-100",
        SK: "METADATA",
        orderId: "ord-100",
        customerId: "cust-1",
        status: "COMPLETED",
        totalAmount: 2500
      }
    });

    const order = await service.getOrder("ord-100");

    expect(order.orderId).toBe("ord-100");
    expect(order.status).toBe("COMPLETED");
    expect(order.PK).toBeUndefined();
  });

  test("should throw NotFoundError if order does not exist", async () => {
    mockDocClient.get.mockResolvedValueOnce({ Item: null });

    await expect(service.getOrder("ord-nonexistent")).rejects.toThrow(NotFoundError);
  });
});

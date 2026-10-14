import { IdempotencyManager } from "../../src/lib/idempotency/idempotency-manager.js";

describe("IdempotencyManager", () => {
  let mockDocClient;
  let manager;
  const tableName = "orders-dev";

  beforeEach(() => {
    mockDocClient = {
      put: jest.fn(),
      get: jest.fn(),
      update: jest.fn()
    };
    manager = new IdempotencyManager(mockDocClient, tableName, 86400);
  });

  test("should successfully claim a new event", async () => {
    mockDocClient.put.mockResolvedValueOnce({});

    const result = await manager.claimProcessing("evt-123", "ord-456");

    expect(result).toEqual({ isNew: true, completed: false });
    expect(mockDocClient.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: tableName,
        Item: expect.objectContaining({
          PK: "IDEMPOTENCY#evt-123",
          SK: "RECORD",
          eventId: "evt-123",
          orderId: "ord-456",
          status: "IN_PROGRESS"
        }),
        ConditionExpression: "attribute_not_exists(PK)"
      })
    );
  });

  test("should detect an already completed duplicate event and return cached result", async () => {
    const error = new Error("The conditional request failed");
    error.name = "ConditionalCheckFailedException";
    mockDocClient.put.mockRejectedValueOnce(error);

    mockDocClient.get.mockResolvedValueOnce({
      Item: {
        PK: "IDEMPOTENCY#evt-123",
        SK: "RECORD",
        status: "COMPLETED",
        result: { orderId: "ord-456", status: "COMPLETED" }
      }
    });

    const result = await manager.claimProcessing("evt-123", "ord-456");

    expect(result.isNew).toBe(false);
    expect(result.completed).toBe(true);
    expect(result.cachedResult).toEqual({ orderId: "ord-456", status: "COMPLETED" });
    expect(mockDocClient.get).toHaveBeenCalledWith({
      TableName: tableName,
      Key: { PK: "IDEMPOTENCY#evt-123", SK: "RECORD" }
    });
  });

  test("should detect an in-progress duplicate event", async () => {
    const error = new Error("The conditional request failed");
    error.name = "ConditionalCheckFailedException";
    mockDocClient.put.mockRejectedValueOnce(error);

    mockDocClient.get.mockResolvedValueOnce({
      Item: {
        PK: "IDEMPOTENCY#evt-123",
        SK: "RECORD",
        status: "IN_PROGRESS"
      }
    });

    const result = await manager.claimProcessing("evt-123", "ord-456");

    expect(result.isNew).toBe(false);
    expect(result.completed).toBe(false);
    expect(result.inProgress).toBe(true);
  });

  test("should mark event processing as completed", async () => {
    mockDocClient.update.mockResolvedValueOnce({});

    await manager.completeProcessing("evt-123", { orderId: "ord-456" });

    expect(mockDocClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: tableName,
        Key: { PK: "IDEMPOTENCY#evt-123", SK: "RECORD" },
        UpdateExpression: expect.stringContaining("SET #status = :completed"),
        ExpressionAttributeValues: expect.objectContaining({
          ":completed": "COMPLETED",
          ":result": { orderId: "ord-456" }
        })
      })
    );
  });
});

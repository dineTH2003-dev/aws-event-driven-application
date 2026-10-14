/**
 * Idempotency Manager for Distributed Event Consumers
 * Uses Amazon DynamoDB conditional writes to guarantee exactly-once processing
 * over at-least-once messaging transports (SQS / SNS).
 */

export class IdempotencyManager {
  /**
   * @param {object} docClient - DynamoDB Document Client (from @aws-sdk/lib-dynamodb)
   * @param {string} tableName - DynamoDB table name
   * @param {number} [ttlSeconds=86400] - Lock expiration in seconds (default: 24h)
   */
  constructor(docClient, tableName, ttlSeconds = 86400) {
    this.docClient = docClient;
    this.tableName = tableName;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Claims an event for processing using an atomic conditional write.
   * @param {string} eventId - Unique event identifier
   * @param {string} orderId - Associated order identifier
   * @returns {Promise<{ isNew: boolean, completed: boolean, inProgress?: boolean, cachedResult?: any }>}
   */
  async claimProcessing(eventId, orderId) {
    const pk = `IDEMPOTENCY#${eventId}`;
    const sk = "RECORD";
    const nowEpoch = Math.floor(Date.now() / 1000);
    const ttl = nowEpoch + this.ttlSeconds;

    try {
      await this.docClient.put({
        TableName: this.tableName,
        Item: {
          PK: pk,
          SK: sk,
          eventId,
          orderId,
          status: "IN_PROGRESS",
          claimedAt: new Date().toISOString(),
          ttl
        },
        ConditionExpression: "attribute_not_exists(PK)"
      });

      return { isNew: true, completed: false };
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException" || error.code === "ConditionalCheckFailedException") {
        // Record already exists. Fetch it to inspect state
        const existing = await this.docClient.get({
          TableName: this.tableName,
          Key: { PK: pk, SK: sk }
        });

        if (existing && existing.Item) {
          if (existing.Item.status === "COMPLETED") {
            return {
              isNew: false,
              completed: true,
              cachedResult: existing.Item.result
            };
          }

          return {
            isNew: false,
            completed: false,
            inProgress: true
          };
        }
      }

      throw error;
    }
  }

  /**
   * Marks the event as successfully completed and stores optional response payload.
   * @param {string} eventId
   * @param {any} [result=null]
   */
  async completeProcessing(eventId, result = null) {
    const pk = `IDEMPOTENCY#${eventId}`;
    const sk = "RECORD";

    await this.docClient.update({
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: "SET #status = :completed, completedAt = :now, #result = :result",
      ExpressionAttributeNames: {
        "#status": "status",
        "#result": "result"
      },
      ExpressionAttributeValues: {
        ":completed": "COMPLETED",
        ":now": new Date().toISOString(),
        ":result": result
      }
    });
  }
}

/**
 * DynamoDB Client Initialization
 * Configured with standard AWS SDK v3 connection pooling and exponential backoff retries.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function createDynamoDBDocClient(clientConfig = {}) {
  const ddbClient = new DynamoDBClient({
    maxAttempts: 3,
    ...clientConfig
  });

  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false
    },
    unmarshallOptions: {
      wrapNumbers: false
    }
  });
}

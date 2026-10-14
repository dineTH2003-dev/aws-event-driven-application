/**
 * DynamoDB Client Initialization
 * Configured with standard AWS SDK v3 connection pooling, exponential backoff retries,
 * and ergonomic put/get/update command wrappers.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

export function createDynamoDBDocClient(clientConfig = {}) {
  const ddbClient = new DynamoDBClient({
    maxAttempts: 3,
    ...clientConfig
  });

  const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false
    },
    unmarshallOptions: {
      wrapNumbers: false
    }
  });

  return {
    rawClient: docClient,
    send: (command) => docClient.send(command),
    put: (params) => docClient.send(new PutCommand(params)),
    get: (params) => docClient.send(new GetCommand(params)),
    update: (params) => docClient.send(new UpdateCommand(params)),
    delete: (params) => docClient.send(new DeleteCommand(params)),
    query: (params) => docClient.send(new QueryCommand(params))
  };
}

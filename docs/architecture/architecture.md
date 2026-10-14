# 🏛️ Architecture Specification

## 1. Overview
The **AWS Event-Driven Order Processing Platform** is an enterprise-oriented serverless application designed to process high-volume order transactions asynchronously. It replaces traditional synchronous request-response chains with a decoupled, message-buffered event-driven architecture.

## 2. Component Breakdown

### 2.1 Ingestion Tier
- **Amazon API Gateway (REST API)**:
  - Exposes `POST /orders` (order creation) and `GET /orders/{orderId}` (order query).
  - Validates request payload schemas before invoking compute.
  - Applies per-client and global rate limiting (e.g., 50 req/s steady state, 100 req/s burst).
  - Immediately acknowledges valid requests with HTTP `202 Accepted` returning `{ "orderId": "ord-...", "status": "PENDING" }`.
- **Lambda Function (`create-order`)**:
  - Stateless execution with 256MB memory and 10s timeout.
  - Performs initial persistence of order record with status `PENDING` in DynamoDB.
  - Generates CloudEvents 1.0 compliant `OrderCreated` event envelope.
  - Publishes event to Amazon SNS Topic.

### 2.2 Messaging & Decoupling Tier
- **Amazon SNS Topic (`order-events-topic`)**:
  - Acts as a centralized event broker / publisher.
  - Implements fan-out distribution to multiple subscribers.
  - Enforces server-side encryption with AWS managed KMS keys.
  - Supports message attributes for subscription filter policies.
- **Amazon SQS Queue (`order-processing-queue`)**:
  - Subscribed to `order-events-topic`.
  - Acts as a durable buffer absorbing surges in order creation.
  - **Visibility Timeout**: 180 seconds (strictly configured to 6x Lambda consumer timeout of 30s to prevent premature duplicate deliveries).
  - **Message Retention Period**: 4 days.
  - **Delivery Delay**: 0 seconds.
  - **Receive Message Wait Time**: 20 seconds (long polling to minimize empty receives and cost).
  - **Redrive Policy**: Configured to divert to Dead-Letter Queue after `maxReceiveCount = 3`.
- **Amazon SQS Dead-Letter Queue (`order-processing-dlq`)**:
  - Isolates malformed, corrupt, or repeatedly failing poison-pill messages.
  - **Retention Period**: 14 days (maximum allowable to give SREs ample time to diagnose and redrive).
  - CloudWatch Alarm configured on `ApproximateNumberOfMessagesVisible > 0`.

### 2.3 Compute & Fulfillment Tier
- **Lambda Function (`process-order`)**:
  - Triggered via SQS Event Source Mapping with `batch_size = 10` and `maximum_batching_window_in_seconds = 5`.
  - Enables `ReportBatchItemFailures` so that if 1 message in a batch of 10 fails, only that specific message is retried, avoiding redundant re-execution of the 9 successful ones.
  - Executes application-level idempotency lock on DynamoDB.
  - Executes business logic: order validation, stock reservation simulation, total price computation.
  - Updates order status to `COMPLETED` (or `FAILED` for terminal business errors) in DynamoDB.
  - Publishes `OrderCompleted` event to SNS topic.
- **Downstream Subscriber (`publish-notification`)**:
  - Demonstrates pub/sub fan-out decoupling.
  - Listens on a dedicated SQS queue subscribed to `order-events-topic` with filter policy `eventType: ["com.example.orders.completed"]`.
  - Simulates sending customer confirmation emails or push notifications.

### 2.4 Persistence Tier
- **Amazon DynamoDB (`orders` table)**:
  - Single-table design storing both order lifecycle records and idempotency locks.
  - Billing mode: `PAY_PER_REQUEST` (On-Demand auto-scaling).
  - Server-side encryption enabled.
  - Time to Live (TTL) enabled on `ttl` attribute for automated cleanup of transient idempotency records after 24 hours.

## 3. Resilience & Failure Taxonomy
1. **Transient Errors** (e.g. temporary network timeouts, DynamoDB throttling):
   - Handled via SQS redrive. The message remains unacknowledged, visibility timeout expires, and SQS delivers it again up to 3 times.
2. **Terminal Business Errors** (e.g. insufficient inventory, expired promotion):
   - Business state transitions to `FAILED`. Order is updated in DynamoDB, and message is acknowledged (removed from SQS) since retrying would yield the same business rejection.
3. **Poison Pills & Unhandled Exceptions** (e.g. malformed JSON, bug in business logic):
   - Worker throws unhandled exception; message is retried up to 3 times.
   - SQS redrive policy automatically diverts message to the Dead-Letter Queue (DLQ).
   - CloudWatch Alarm alerts SRE team for investigation.

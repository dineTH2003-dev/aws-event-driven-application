# ADR 0001: Event-Driven Architecture over Synchronous REST Processing

## Status
Accepted

## Context
In a conventional synchronous three-tier or serverless REST API, when a client calls `POST /orders`, the API handler synchronously performs all sequential tasks: validation, payment deduction, inventory reservation, warehouse event dispatch, and notification sending. 

Under surge traffic conditions (e.g. flash sales or marketing campaigns):
1. High request concurrency directly exhausts downstream services, databases, and third-party APIs.
2. If any downstream system fails or suffers high latency, the entire client request times out or fails (cascading failure).
3. The API client is forced to hold an open HTTP connection for seconds while internal systems coordinate.

## Decision
We adopt an **Asynchronous Event-Driven Architecture (EDA)** using **Amazon API Gateway $\rightarrow$ AWS Lambda $\rightarrow$ Amazon SNS $\rightarrow$ Amazon SQS $\rightarrow$ AWS Lambda**:
1. The ingestion API validates the payload structure and immediately acknowledges the order with HTTP `202 Accepted` returning a unique `orderId`.
2. An `OrderCreated` event is published to an SNS topic and buffered in an SQS queue.
3. Asynchronous worker Lambdas process orders independently, pulling messages from SQS at a controlled, scalable rate.

## Consequences
### Positive
- **Fault Isolation**: Downstream processing delays or temporary outages do not impact API responsiveness or cause client timeouts.
- **Traffic Smoothing (Load Leveling)**: SQS buffers sudden spikes in traffic, protecting the downstream database and fulfillment services from being overwhelmed.
- **Independent Scalability**: Ingestion and fulfillment scale independently according to their respective bottlenecks.
- **Extensibility**: Additional downstream consumers (e.g., fraud analysis, audit logging, analytics) can subscribe to order events without changing the order ingestion service.

### Negative / Trade-offs
- **Eventual Consistency**: Clients must query `GET /orders/{orderId}` or subscribe to webhooks/notifications to learn the final status.
- **System Complexity**: Requires handling distributed failures, message retries, dead-letter queues, and idempotency.

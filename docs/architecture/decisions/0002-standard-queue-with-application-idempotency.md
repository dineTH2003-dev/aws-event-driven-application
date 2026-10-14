# ADR 0002: Standard SQS Queue with Application-Level Idempotency vs FIFO Queue

## Status
Accepted

## Context
When buffering asynchronous messages with Amazon SQS, architects must choose between two queue models:
1. **FIFO Queues**: Guarantee strictly-once delivery and strict first-in-first-out ordering per message group. However, standard FIFO throughput is capped at 300 transactions/second (or 3,000 TPS with high-throughput batching mode). FIFO also blocks the entire message group if a single message fails repeatedly.
2. **Standard Queues**: Provide nearly unlimited throughput, lowest latency, and loose ordering. However, standard queues guarantee **at-least-once delivery**, which means duplicate deliveries can and do occur during network retries or worker restarts.

## Decision
We choose **Standard SQS Queues paired with Application-Level Idempotency** managed in Amazon DynamoDB:
1. SQS Standard Queues are used for maximum scalability and decoupling.
2. Before executing any non-idempotent business action (e.g. reserving inventory or charging payments), the worker Lambda executes an atomic conditional write in DynamoDB:
   `PutItem` with condition `attribute_not_exists(PK)` where `PK = IDEMPOTENCY#<eventId>`.
3. If the record already exists and is marked `COMPLETED`, the worker immediately recognizes the message as a duplicate and acknowledges it without executing side effects.
4. Idempotency records are assigned a Time-To-Live (TTL) of 24 hours so that temporary deduplication records automatically expire and do not accumulate storage costs.

## Consequences
### Positive
- **Unlimited Throughput**: System is not bound by FIFO partition caps.
- **Resilience**: A poison-pill in one order does not block orders for other customers.
- **Safety**: Exactly-once processing semantics are guaranteed at the business domain level regardless of transport duplicates.

### Negative / Trade-offs
- Requires an additional DynamoDB call per message processed to check/set the idempotency key.
- Order processing is loosely ordered across concurrent workers, which is acceptable for independent order transactions.

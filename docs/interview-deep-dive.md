# 🎓 AWS Event-Driven Architecture: Interview Masterclass & Technical Q&A

This guide prepares you to articulate every architectural decision, distributed systems trade-off, and operational mechanism implemented in this project during senior cloud and DevOps engineering interviews.

---

### Q1: Why place an SQS queue between SNS and Lambda instead of invoking Lambda directly from SNS?

**Candidate Answer:**
"While Amazon SNS can directly trigger an AWS Lambda function, doing so introduces tight concurrency coupling. If SNS receives a sudden traffic surge (e.g. 5,000 events/second), it immediately invokes 5,000 concurrent Lambda instances. This can instantly exhaust account-level Lambda concurrency pools and overwhelm downstream databases like DynamoDB or RDS with connection spikes.

By placing an SQS queue between SNS and Lambda (the **SNS $\rightarrow$ SQS $\rightarrow$ Lambda Fan-Out pattern**):

1. **Load Leveling / Buffering**: SQS acts as a shock absorber, storing messages safely until the Lambda worker has capacity to process them.
2. **Controlled Concurrency**: We can tune Lambda concurrency and batch size (e.g., 10 messages per invocation) to protect downstream persistence layers.
3. **Dedicated Failure Semantics**: Each subscriber gets its own independent queue, visibility timeout, retry policy, and Dead-Letter Queue (DLQ). If one subscriber (e.g. Analytics) is slow or failing, it has zero impact on other subscribers (e.g. Customer Notifications)."

---

### Q2: SQS guarantees at-least-once delivery. How does your system achieve exactly-once business processing?

**Candidate Answer:**
"Standard SQS guarantees that messages are delivered _at least once_, meaning network retries, worker crashes, or visibility timeouts can cause a message to be delivered multiple times. True exactly-once processing must be implemented at the **application layer via idempotency**.

In our architecture:

1. Every event has a globally unique `id` (CloudEvents 1.0 format).
2. Before executing any business mutation, the worker Lambda executes an atomic conditional write in DynamoDB:
   `PutItem` with condition `attribute_not_exists(PK)` where `PK = IDEMPOTENCY#<eventId>` and `status = IN_PROGRESS`.
3. If the item already exists with status `COMPLETED`, the conditional write fails with a `ConditionalCheckFailedException`. The worker recognizes this as a completed duplicate and acknowledges the SQS message without re-executing side effects.
4. We assign a 24-hour Time-to-Live (`ttl`) attribute to the idempotency record so DynamoDB automatically cleans up transient deduplication keys without consuming capacity."

---

### Q3: How do you configure SQS Visibility Timeout relative to Lambda Function Timeout? What happens if you get it wrong?

**Candidate Answer:**
"The AWS Well-Architected recommendation is to set the **SQS Visibility Timeout to at least 6 times the Lambda Function Timeout**. In our project, with a 30-second Lambda timeout, the visibility timeout is set to 180 seconds.

**What happens if configured incorrectly:**

- If Visibility Timeout is **less than or equal to Lambda Timeout** (e.g., Visibility = 30s, Lambda Timeout = 30s): If the worker takes 31 seconds to process a batch, SQS assumes the worker crashed, makes the message visible again, and another worker instance picks it up. This triggers duplicate processing storms and race conditions.
- By setting it to 6x, we guarantee that the current invocation has completed or timed out and allows for built-in SDK retries before SQS makes the message visible to another consumer."

---

### Q4: What is `ReportBatchItemFailures` and why is it critical when processing SQS batches with Lambda?

**Candidate Answer:**
"By default, when Lambda processes a batch of SQS messages (e.g. 10 messages):

- If the function succeeds, all 10 messages are deleted from the queue.
- If the function throws an unhandled error on message #8, the **entire batch of 10 messages fails**. All 10 messages remain in SQS and will be reprocessed on the next attempt, causing unnecessary repeated executions of messages #1 through #7.

By enabling `ReportBatchItemFailures` in the event source mapping, our Lambda returns a structured response containing only the failed message IDs:

```json
{
  "batchItemFailures": [{ "itemIdentifier": "msg-8-id" }]
}
```

Lambda deletes the 9 successful messages from SQS and leaves only message #8 in the queue for retry. This prevents duplicate processing storms and saves compute costs."

---

### Q5: When would you choose an SQS FIFO Queue over a Standard Queue?

**Candidate Answer:**
"**SQS Standard Queues** provide:

- Virtually unlimited throughput (tens of thousands of messages per second).
- Best-effort ordering.
- At-least-once delivery (requires application idempotency).

**SQS FIFO Queues** provide:

- Strict First-In-First-Out ordering per `MessageGroupId`.
- Exactly-once transport delivery (via `MessageDeduplicationId` within a 5-minute deduplication window).
- Throughput limited to 300 transactions/second (or 3,000 TPS with high-throughput batching).
- Risk of Head-of-Line (HoL) blocking: if message #1 fails, no subsequent messages in that same `MessageGroupId` can be processed until message #1 succeeds or reaches the DLQ.

In our order processing system, independent customer orders do not require global strict ordering across the entire platform. Standard Queues with application idempotency provide the highest scalability and resilience."

---

### Q6: How do you isolate and recover from poison-pill messages?

**Candidate Answer:**
"A poison-pill is a malformed message that consistently causes consumer processing code to crash.

1. **Isolation**: We configure a redrive policy on the primary SQS queue with `maxReceiveCount = 3` pointing to a Dead-Letter Queue (`order-processing-dlq`).
2. **Monitoring**: A CloudWatch Alarm fires when `ApproximateNumberOfMessagesVisible > 0` on the DLQ, alerting SREs via SNS.
3. **Investigation**: SREs inspect the message body and correlation ID to view structured CloudWatch Logs.
4. **Remediation & Redrive**: Once the underlying bug is patched and deployed, we invoke the native AWS SQS Redrive API (`StartMessageMoveTask`) to move messages back to the primary queue for safe reprocessing."

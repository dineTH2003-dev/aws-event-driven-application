# 📖 SRE Runbook: SQS Queue Backlog & Processing Delays

## 1. Alert Trigger
- **Alarm Name**: `OrderProcessingQueue_OldestMessage_Age`
- **Condition**: `ApproximateAgeOfOldestMessage > 60` seconds on `order-processing-queue`.
- **Severity**: P2 (High)

---

## 2. Problem Overview
Messages are remaining in the queue longer than the 60-second operational target. This means the consumer ingestion rate is lower than the producer publishing rate, or the worker Lambda is throttling or experiencing high latency.

---

## 3. Diagnostic Steps

### Step 1: Check Current Queue Metrics
```bash
export AWS_PROFILE=account2
export AWS_REGION=ap-south-1

QUEUE_URL=$(aws sqs get-queue-url --queue-name order-processing-queue --output text)

aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible ApproximateAgeOfOldestMessage
```

### Step 2: Check Lambda Concurrency & Throttling
Check CloudWatch Metrics for function `orders-worker-dev`:
- `Throttles`: If `Throttles > 0`, Lambda is hitting account or reserved concurrency limits.
- `Duration`: If execution duration is approaching the 30s timeout, workers are spending excessive time on downstream calls.
- `ConcurrentExecutions`: Inspect how many workers are active in parallel.

### Step 3: Check DynamoDB Capacity
If DynamoDB is returning `ProvisionedThroughputExceededException`, worker writes are being delayed. Ensure the table is set to On-Demand billing.

---

## 4. Remediation Procedure

1. **If Lambda is Throttling**:
   - Check account-level concurrency limits in `ap-south-1`.
   - Ensure the SQS Event Source Mapping `maximum_concurrency` setting is not artificially constrained too low.
2. **If Workers are Slow**:
   - Inspect X-Ray traces or CloudWatch Logs Insights to determine which step (DynamoDB write or SNS publish) is taking time.
3. **Emergency Scaling**:
   - Increase Lambda batch size from 10 to 20 or decrease batch window to 1s to trigger more rapid invocations.

# 📖 SRE Runbook: Dead-Letter Queue (DLQ) Investigation & Redrive

## 1. Alert Trigger

- **Alarm Name**: `OrderProcessingDLQ_Messages_Present`
- **Condition**: `ApproximateNumberOfMessagesVisible > 0` on `order-processing-dlq` for 1 evaluation period.
- **Severity**: P2 (High)

---

## 2. Problem Overview

A message reached the DLQ because the `process-order` Lambda worker failed to process it after 3 consecutive attempts (`maxReceiveCount = 3`). This indicates a poison pill, an unhandled exception, a malformed payload, or a persistent downstream dependency outage.

---

## 3. Diagnostic Steps

### Step 1: Inspect DLQ Messages via AWS CLI

```bash
export AWS_PROFILE=account2
export AWS_REGION=ap-south-1

# Get DLQ URL
DLQ_URL=$(aws sqs get-queue-url --queue-name order-processing-dlq --output text)

# Receive and inspect the failing message without deleting it
aws sqs receive-message \
  --queue-url "$DLQ_URL" \
  --attribute-names All \
  --message-attribute-names All \
  --max-number-of-messages 1 \
  --visibility-timeout 30
```

### Step 2: Query CloudWatch Logs for the Error

Extract the `orderId` or `eventId` from the received message body and query CloudWatch Logs Insights:

```sql
fields @timestamp, level, service, eventId, orderId, @message, error.stack
| filter orderId = "ord-xxxx" or eventId = "evt-xxxx"
| sort @timestamp desc
| limit 20
```

### Step 3: Classify the Root Cause

- **Schema / Payload Defect**: The incoming JSON violated required fields or types.
- **Application Logic Bug**: Unhandled null pointer, division by zero, or edge case.
- **Dependency Downtime**: DynamoDB throttling or external service unavailability during all 3 attempts.

---

## 4. Remediation & Redrive Procedure

### Scenario A: Application Bug Fixed in Code

1. Fix the bug in `src/functions/process-order/service.js`.
2. Commit, test locally (`npm test`), and deploy the patched Lambda.
3. Use the AWS SQS Redrive feature to move the messages back to the primary queue:

```bash
MAIN_QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url $(aws sqs get-queue-url --queue-name order-processing-queue --output text) --attribute-names QueueArn --query "Attributes.QueueArn" --output text)

# Start redrive task
aws sqs start-message-move-task \
  --source-arn $(aws sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query "Attributes.QueueArn" --output text) \
  --destination-arn "$MAIN_QUEUE_ARN"
```

### Scenario B: Unrecoverable Poison Pill (Corrupt Data)

If the message is permanently invalid and cannot be processed:

1. Export the message payload to an incident archive or S3 dead-letter bucket for audit.
2. Manually purge or delete the message from the DLQ:

```bash
aws sqs delete-message --queue-url "$DLQ_URL" --receipt-handle "<RECEIPT_HANDLE>"
```

#!/usr/bin/env bash
# Injects a poison pill event to test DLQ diversion and retry limits
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-account2}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
QUEUE_NAME="${QUEUE_NAME:-orders-eda-dev-order-processing-queue}"

echo "☠️ Injecting poison-pill message directly into SQS queue: $QUEUE_NAME..."
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" --query "QueueUrl" --output text)

POISON_PAYLOAD='{
  "specversion": "1.0",
  "id": "evt-poison-pill-test",
  "source": "chaos-test-harness",
  "type": "com.example.orders.created",
  "time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "ord-poison-9999",
    "testChaos": "TRIGGER_UNHANDLED_EXCEPTION",
    "simulateFailure": true
  }
}'

aws sqs send-message \
  --queue-url "$QUEUE_URL" \
  --message-body "$POISON_PAYLOAD" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"

echo "✅ Poison-pill message enqueued to $QUEUE_URL."
echo "The worker will retry 3 times before diverting message to Dead-Letter Queue (DLQ)."

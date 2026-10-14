#!/usr/bin/env bash
# Redrives dead-letter queue messages back to the primary processing queue
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-account2}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
DLQ_NAME="${DLQ_NAME:-orders-eda-dev-order-processing-dlq}"
MAIN_QUEUE_NAME="${MAIN_QUEUE_NAME:-orders-eda-dev-order-processing-queue}"

echo "🔄 Starting SQS DLQ Redrive task from $DLQ_NAME to $MAIN_QUEUE_NAME..."

DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url --queue-name "$DLQ_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'QueueUrl' --output text)" \
  --attribute-names QueueArn \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'Attributes.QueueArn' \
  --output text)

MAIN_QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url --queue-name "$MAIN_QUEUE_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'QueueUrl' --output text)" \
  --attribute-names QueueArn \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'Attributes.QueueArn' \
  --output text)

TASK_HANDLE=$(aws sqs start-message-move-task \
  --source-arn "$DLQ_ARN" \
  --destination-arn "$MAIN_QUEUE_ARN" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'TaskHandle' \
  --output text)

echo "✅ Redrive task initiated with TaskHandle: $TASK_HANDLE"
echo "Monitoring task status..."

aws sqs list-message-move-tasks \
  --source-arn "$DLQ_ARN" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"

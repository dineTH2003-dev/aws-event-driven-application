# Amazon SNS Topic & Amazon SQS Messaging Backbone

# 1. Primary Order Events Topic
resource "aws_sns_topic" "order_events" {
  name              = "${local.name_prefix}-order-events"
  kms_master_key_id = "alias/aws/sns"
}

# 2. Dead-Letter Queue (Failed Message Isolation)
resource "aws_sqs_queue" "order_processing_dlq" {
  name                      = "${local.name_prefix}-order-processing-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true
}

# 3. Main Order Processing Queue (Buffering & Decoupling)
resource "aws_sqs_queue" "order_processing_queue" {
  name                       = "${local.name_prefix}-order-processing-queue"
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds # 180s (6x Lambda timeout)
  message_retention_seconds  = 345600                             # 4 days
  receive_wait_time_seconds  = 20                                 # Long polling
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_processing_dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })
}

# 4. SQS Queue Policy for Main Queue (Authorizes SNS Topic)
resource "aws_sqs_queue_policy" "order_processing_queue_policy" {
  queue_url = aws_sqs_queue.order_processing_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSNSOrderEventsPublish"
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.order_processing_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.order_events.arn
          }
        }
      }
    ]
  })
}

# 5. SNS to SQS Subscription for Main Queue
resource "aws_sns_topic_subscription" "order_queue_subscription" {
  topic_arn            = aws_sns_topic.order_events.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.order_processing_queue.arn
  raw_message_delivery = true
}

# 6. Downstream Fan-out Notification Queue (Subscriber)
resource "aws_sqs_queue" "notification_queue" {
  name                      = "${local.name_prefix}-notification-queue"
  message_retention_seconds = 86400 # 1 day
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSNSNotificationPublish"
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.notification_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.order_events.arn
          }
        }
      }
    ]
  })
}

# 7. SNS Subscription for Notification Queue (Filtered on OrderCompleted)
resource "aws_sns_topic_subscription" "notification_subscription" {
  topic_arn            = aws_sns_topic.order_events.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.notification_queue.arn
  raw_message_delivery = true

  filter_policy = jsonencode({
    type = ["com.example.orders.completed"]
  })
}

# 8. Real Email Notification Subscription (Order Events & Alerts)
resource "aws_sns_topic_subscription" "user_email_subscription" {
  count     = var.notification_email != null && var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

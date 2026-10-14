# IAM Execution Roles & Policies (Least-Privilege)

data "aws_caller_identity" "current" {}

# 1. Order Ingestion Lambda Role
resource "aws_iam_role" "create_order_lambda_role" {
  name = "${local.name_prefix}-create-order-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "create_order_lambda_policy" {
  name        = "${local.name_prefix}-create-order-policy"
  description = "Least privilege permissions for order creation Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.create_order_logs.arn}:*"
      },
      {
        Sid    = "SNSPublish"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.order_events.arn
      },
      {
        Sid    = "DynamoDBInitialOrder"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.orders.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "create_order_attach" {
  role       = aws_iam_role.create_order_lambda_role.name
  policy_arn = aws_iam_policy.create_order_lambda_policy.arn
}

# 2. Order Fulfillment Worker Lambda Role
resource "aws_iam_role" "process_order_lambda_role" {
  name = "${local.name_prefix}-process-order-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "process_order_lambda_policy" {
  name        = "${local.name_prefix}-process-order-policy"
  description = "Least privilege permissions for order worker Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.process_order_logs.arn}:*"
      },
      {
        Sid    = "SQSConsume"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.order_processing_queue.arn
      },
      {
        Sid    = "DynamoDBOrderAndIdempotency"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.orders.arn
      },
      {
        Sid    = "SNSPublishOutcomes"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.order_events.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "process_order_attach" {
  role       = aws_iam_role.process_order_lambda_role.name
  policy_arn = aws_iam_policy.process_order_lambda_policy.arn
}

# 3. Downstream Notification Lambda Role
resource "aws_iam_role" "notification_lambda_role" {
  name = "${local.name_prefix}-notification-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "notification_lambda_policy" {
  name        = "${local.name_prefix}-notification-policy"
  description = "Least privilege permissions for notification subscriber Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.notification_logs.arn}:*"
      },
      {
        Sid    = "SQSConsumeNotification"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.notification_queue.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "notification_attach" {
  role       = aws_iam_role.notification_lambda_role.name
  policy_arn = aws_iam_policy.notification_lambda_policy.arn
}

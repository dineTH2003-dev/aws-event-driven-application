# AWS Lambda Compute Tier & Event Source Mappings

# 1. Package individual Lambda handlers built with esbuild
data "archive_file" "create_order_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../dist/create-order"
  output_path = "${path.module}/dist_create_order.zip"
}

data "archive_file" "process_order_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../dist/process-order"
  output_path = "${path.module}/dist_process_order.zip"
}

data "archive_file" "notification_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../dist/publish-notification"
  output_path = "${path.module}/dist_notification.zip"
}

# 2. CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "create_order_logs" {
  name              = "/aws/lambda/${local.name_prefix}-create-order"
  retention_in_days = var.log_retention_in_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "process_order_logs" {
  name              = "/aws/lambda/${local.name_prefix}-process-order"
  retention_in_days = var.log_retention_in_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "notification_logs" {
  name              = "/aws/lambda/${local.name_prefix}-publish-notification"
  retention_in_days = var.log_retention_in_days
  tags              = local.common_tags
}

# 3. Ingestion Lambda (create-order)
resource "aws_lambda_function" "create_order" {
  function_name    = "${local.name_prefix}-create-order"
  filename         = data.archive_file.create_order_package.output_path
  source_code_hash = data.archive_file.create_order_package.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.create_order_lambda_role.arn
  timeout          = 10
  memory_size      = 256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ORDERS_TABLE_NAME      = aws_dynamodb_table.orders.name
      ORDER_EVENTS_TOPIC_ARN = aws_sns_topic.order_events.arn
      NODE_OPTIONS           = "--enable-source-maps"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.create_order_logs,
    aws_iam_role_policy_attachment.create_order_attach,
    aws_iam_role_policy_attachment.create_order_xray
  ]

  tags = local.common_tags
}

# 4. Fulfillment Worker Lambda (process-order)
resource "aws_lambda_function" "process_order" {
  function_name    = "${local.name_prefix}-process-order"
  filename         = data.archive_file.process_order_package.output_path
  source_code_hash = data.archive_file.process_order_package.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.process_order_lambda_role.arn
  timeout          = var.lambda_timeout_seconds
  memory_size      = 256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ORDERS_TABLE_NAME      = aws_dynamodb_table.orders.name
      ORDER_EVENTS_TOPIC_ARN = aws_sns_topic.order_events.arn
      NODE_OPTIONS           = "--enable-source-maps"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.process_order_logs,
    aws_iam_role_policy_attachment.process_order_attach,
    aws_iam_role_policy_attachment.process_order_xray
  ]

  tags = local.common_tags
}

# 5. SQS Event Source Mapping for Fulfillment Worker
resource "aws_lambda_event_source_mapping" "process_order_sqs_trigger" {
  event_source_arn                   = aws_sqs_queue.order_processing_queue.arn
  function_name                      = aws_lambda_function.process_order.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true
}

# 6. Downstream Notification Subscriber Lambda
resource "aws_lambda_function" "notification" {
  function_name    = "${local.name_prefix}-publish-notification"
  filename         = data.archive_file.notification_package.output_path
  source_code_hash = data.archive_file.notification_package.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.notification_lambda_role.arn
  timeout          = 10
  memory_size      = 256

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.notification_logs,
    aws_iam_role_policy_attachment.notification_attach,
    aws_iam_role_policy_attachment.notification_xray
  ]

  tags = local.common_tags
}

# 6. SQS Event Source Mapping for Notification Subscriber
resource "aws_lambda_event_source_mapping" "notification_sqs_trigger" {
  event_source_arn = aws_sqs_queue.notification_queue.arn
  function_name    = aws_lambda_function.notification.arn
  batch_size       = 5
  enabled          = true
}

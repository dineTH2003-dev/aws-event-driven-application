# CloudWatch Operational SRE Dashboard

resource "aws_cloudwatch_dashboard" "orders_dashboard" {
  dashboard_name = "${local.name_prefix}-operational-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.order_processing_queue.name],
            [".", "ApproximateNumberOfMessagesNotVisible", ".", aws_sqs_queue.order_processing_queue.name],
            [".", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.order_processing_dlq.name, { color = "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "SQS Queue Depth & DLQ Isolation"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.order_processing_queue.name]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "SQS Message Latency (Age of Oldest Message)"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.create_order.function_name],
            [".", "Invocations", "FunctionName", aws_lambda_function.process_order.function_name],
            [".", "Errors", "FunctionName", aws_lambda_function.process_order.function_name, { color = "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Invocations & Worker Errors"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.orders_api.name],
            [".", "4XXError", ".", aws_api_gateway_rest_api.orders_api.name],
            [".", "5XXError", ".", aws_api_gateway_rest_api.orders_api.name, { color = "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Traffic & Errors"
          period  = 60
        }
      }
    ]
  })
}

# CloudWatch Metric Alarms for SRE Incident Detection

# 1. DLQ Visible Messages Alarm (Poison Pill Alert)
resource "aws_cloudwatch_metric_alarm" "dlq_messages_present" {
  alarm_name          = "${local.name_prefix}-DLQ-Messages-Present"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Triggers when poison pills or permanently failing messages land in the Dead-Letter Queue"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.order_events.arn]

  dimensions = {
    QueueName = aws_sqs_queue.order_processing_dlq.name
  }

  tags = local.common_tags
}

# 2. Main SQS Queue Message Age Alarm (Backlog Alert)
resource "aws_cloudwatch_metric_alarm" "queue_oldest_message_age" {
  alarm_name          = "${local.name_prefix}-Queue-Oldest-Message-Age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 60 # 60 seconds SLA
  alarm_description   = "Triggers when order processing latency exceeds 60 seconds backlog"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.order_processing_queue.name
  }

  tags = local.common_tags
}

# 3. Worker Lambda Errors Alarm
resource "aws_cloudwatch_metric_alarm" "worker_lambda_errors" {
  alarm_name          = "${local.name_prefix}-Worker-Lambda-Errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Triggers when process-order Lambda encounters unhandled runtime errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.process_order.function_name
  }

  tags = local.common_tags
}

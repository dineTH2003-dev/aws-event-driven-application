output "aws_region" {
  description = "Target deployment region"
  value       = var.aws_region
}

output "environment" {
  description = "Deployed environment name"
  value       = var.environment
}

output "api_endpoint" {
  description = "Base API Gateway endpoint URL"
  value       = "${aws_api_gateway_stage.dev.invoke_url}/orders"
}

output "orders_table_name" {
  description = "DynamoDB Orders & Idempotency table name"
  value       = aws_dynamodb_table.orders.name
}

output "order_events_topic_arn" {
  description = "Amazon SNS Order Events Topic ARN"
  value       = aws_sns_topic.order_events.arn
}

output "order_processing_queue_url" {
  description = "Amazon SQS Primary Queue URL"
  value       = aws_sqs_queue.order_processing_queue.id
}

output "order_processing_queue_arn" {
  description = "Amazon SQS Primary Queue ARN"
  value       = aws_sqs_queue.order_processing_queue.arn
}

output "order_processing_dlq_url" {
  description = "Amazon SQS Dead-Letter Queue URL"
  value       = aws_sqs_queue.order_processing_dlq.id
}

output "order_processing_dlq_arn" {
  description = "Amazon SQS Dead-Letter Queue ARN"
  value       = aws_sqs_queue.order_processing_dlq.arn
}

output "notification_queue_url" {
  description = "Amazon SQS Downstream Notification Queue URL"
  value       = aws_sqs_queue.notification_queue.id
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch Operational SRE Dashboard Name"
  value       = aws_cloudwatch_dashboard.orders_dashboard.dashboard_name
}

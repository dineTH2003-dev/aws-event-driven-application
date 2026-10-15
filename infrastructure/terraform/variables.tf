variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name for deployment"
  type        = string
  default     = null
}

variable "environment" {
  description = "Environment identifier (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Prefix for all application resource names"
  type        = string
  default     = "orders-eda"
}

variable "sqs_visibility_timeout_seconds" {
  description = "Visibility timeout for the primary processing queue (recommended: 6x Lambda timeout)"
  type        = number
  default     = 180
}

variable "sqs_max_receive_count" {
  description = "Maximum delivery attempts before diverting message to DLQ"
  type        = number
  default     = 3
}

variable "lambda_timeout_seconds" {
  description = "Timeout in seconds for Lambda worker execution"
  type        = number
  default     = 30
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention period in days to manage costs"
  type        = number
  default     = 7
}

variable "notification_email" {
  description = "Destination email address for order notifications and SRE incident alerts"
  type        = string
  default     = "dinethdilshan64@gmail.com"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = "aws-event-driven-application"
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "https://github.com/dineTH2003-dev/aws-event-driven-application"
  }
}

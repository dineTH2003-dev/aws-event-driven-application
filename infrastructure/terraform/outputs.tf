output "aws_region" {
  description = "Target deployment region"
  value       = var.aws_region
}

output "environment" {
  description = "Deployed environment name"
  value       = var.environment
}

output "project_name" {
  description = "Project name prefix"
  value       = var.project_name
}

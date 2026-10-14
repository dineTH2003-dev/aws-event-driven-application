#!/usr/bin/env bash
# Clean teardown script for AWS Event-Driven Application
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-account2}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "⚠️ WARNING: You are about to destroy all infrastructure for aws-event-driven-application."
echo "Profile: $AWS_PROFILE | Region: $AWS_REGION"
read -p "Type 'destroy' to confirm: " CONFIRM

if [[ "$CONFIRM" != "destroy" ]]; then
  echo "Destruction canceled."
  exit 0
fi

export AWS_PROFILE="$AWS_PROFILE"
export AWS_REGION="$AWS_REGION"

aws sts get-caller-identity

echo "Destroying Terraform managed resources..."
terraform -chdir=infrastructure/terraform destroy -auto-approve

echo "✅ Teardown complete. Review AWS billing console to verify zero active resources."

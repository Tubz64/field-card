locals {
  name_prefix = "${var.project}-${var.environment}"
}

# Placeholder that proves the CI plan/apply path end-to-end. Cognito,
# DynamoDB, S3 and the API are added here as module calls from ../../modules.
resource "aws_ssm_parameter" "environment" {
  name        = "/${var.project}/${var.environment}/environment"
  description = "Environment marker for ${local.name_prefix}, managed by Terraform."
  type        = "String"
  value       = var.environment
}

output "region" {
  value = var.region
}

output "state_bucket" {
  description = "S3 bucket holding all Terraform state for this project."
  value       = aws_s3_bucket.tfstate.bucket
}

output "github_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "plan_role_arn" {
  description = "Set as GitHub repo variable AWS_PLAN_ROLE_ARN."
  value       = aws_iam_role.gha_plan.arn
}

output "deploy_role_arn" {
  description = "Set as GitHub repo variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.gha_deploy.arn
}

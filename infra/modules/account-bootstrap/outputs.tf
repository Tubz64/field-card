output "account_id" {
  value = local.account_id
}

output "state_bucket" {
  description = "S3 bucket holding this account's Terraform state."
  value       = aws_s3_bucket.tfstate.bucket
}

output "github_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "plan_role_arn" {
  value = aws_iam_role.gha_plan.arn
}

output "deploy_role_arn" {
  value = aws_iam_role.gha_deploy.arn
}

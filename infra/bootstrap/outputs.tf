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

output "workload_accounts" {
  description = "Per-account state bucket and CI role ARNs, keyed by environment."
  value = {
    for env, m in { dev = module.account_dev, prod = module.account_prod } : env => {
      account_id        = m.account_id
      state_bucket      = m.state_bucket
      plan_role_arn     = m.plan_role_arn
      deploy_role_arn   = m.deploy_role_arn
    }
  }
}

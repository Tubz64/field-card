output "account_ids" {
  description = "Workload account IDs, keyed by environment."
  value       = { for env, account in aws_organizations_account.workload : env => account.id }
}

output "workloads_ou_id" {
  description = "ID of the OU holding the workload accounts."
  value       = aws_organizations_organizational_unit.workloads.id
}

output "sso_portal_url" {
  description = "Sign-in URL for the Identity Center access portal."
  value       = "https://${local.identity_store_id}.awsapps.com/start"
}

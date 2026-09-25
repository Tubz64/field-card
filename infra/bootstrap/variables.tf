variable "project" {
  description = "Project name, used as the prefix for every resource name."
  type        = string
  default     = "pawpers"
}

variable "region" {
  description = "Primary AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "aws_account_id" {
  description = "The only AWS account this config may touch (guards against applying with the wrong credentials)."
  type        = string
  default     = "455967503530"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) whose Actions workflows may assume the CI roles. Update if the repo is renamed."
  type        = string
  default     = "Tubz64/field-card"
}

variable "github_owner_id" {
  description = "Numeric ID of the GitHub repo owner (part of the immutable OIDC subject)."
  type        = string
  default     = "32686116"
}

variable "github_repo_id" {
  description = "Numeric ID of the GitHub repo (part of the immutable OIDC subject)."
  type        = string
  default     = "1383652361"
}

variable "github_default_branch" {
  description = "Branch whose pushes may assume the plan role (PRs always can)."
  type        = string
  default     = "master"
}

variable "deploy_environments" {
  description = "GitHub environments whose jobs may assume the deploy role."
  type        = list(string)
  default     = ["dev", "prod"]
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget for alerting, in USD."
  type        = number
  default     = 10
}

variable "budget_alert_emails" {
  description = "Addresses that receive budget alerts. Leave empty to skip creating the budget. Set in terraform.tfvars (gitignored)."
  type        = list(string)
  default     = []
}

variable "project" {
  description = "Project name, used as the prefix for every resource name."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/name) whose Actions workflows may assume the CI roles."
  type        = string
}

variable "github_owner_id" {
  description = "Numeric ID of the GitHub repo owner (part of the immutable OIDC subject)."
  type        = string
}

variable "github_repo_id" {
  description = "Numeric ID of the GitHub repo (part of the immutable OIDC subject)."
  type        = string
}

variable "plan_subject_contexts" {
  description = "OIDC subject contexts (after the repo prefix) that may assume the plan role, e.g. \"pull_request\" or \"ref:refs/heads/master\"."
  type        = list(string)
}

variable "deploy_environments" {
  description = "GitHub environments whose jobs may assume the deploy role. One per account keeps prod credentials out of dev jobs."
  type        = list(string)
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget for this account, in USD."
  type        = number
}

variable "budget_alert_emails" {
  description = "Addresses that receive budget alerts. Empty skips the budget."
  type        = list(string)
  default     = []
}

# Bootstraps the pawpers-dev and pawpers-prod accounts (created in infra/org)
# with their own state bucket, GitHub OIDC provider, CI roles and budget.
#
# Terraform runs with management-account credentials and reaches each account
# through OrganizationAccountAccessRole, which Organizations created there.
# Providers can't be made with for_each, hence one block per account.
#
# Until the stacks move (the next PR switches the envs' backends and the
# GitHub variables), CI still uses the management account's roles and bucket
# defined in the other files here.

provider "aws" {
  alias  = "dev"
  region = var.region

  allowed_account_ids = [var.workload_account_ids["dev"]]

  assume_role {
    role_arn     = "arn:aws:iam::${var.workload_account_ids["dev"]}:role/OrganizationAccountAccessRole"
    session_name = "terraform-bootstrap"
  }

  default_tags {
    tags = {
      Project   = var.project
      Stack     = "bootstrap"
      ManagedBy = "terraform"
      Repo      = var.github_repo
    }
  }
}

provider "aws" {
  alias  = "prod"
  region = var.region

  allowed_account_ids = [var.workload_account_ids["prod"]]

  assume_role {
    role_arn     = "arn:aws:iam::${var.workload_account_ids["prod"]}:role/OrganizationAccountAccessRole"
    session_name = "terraform-bootstrap"
  }

  default_tags {
    tags = {
      Project   = var.project
      Stack     = "bootstrap"
      ManagedBy = "terraform"
      Repo      = var.github_repo
    }
  }
}

module "account_dev" {
  source    = "../modules/account-bootstrap"
  providers = { aws = aws.dev }

  project         = var.project
  github_repo     = var.github_repo
  github_owner_id = var.github_owner_id
  github_repo_id  = var.github_repo_id

  # Every PR may plan dev (read-only); only the dev environment may deploy.
  plan_subject_contexts = ["pull_request"]
  deploy_environments   = ["dev"]

  monthly_budget_usd  = var.workload_monthly_budget_usd
  budget_alert_emails = var.budget_alert_emails
}

module "account_prod" {
  source    = "../modules/account-bootstrap"
  providers = { aws = aws.prod }

  project         = var.project
  github_repo     = var.github_repo
  github_owner_id = var.github_owner_id
  github_repo_id  = var.github_repo_id

  plan_subject_contexts = ["pull_request"]
  deploy_environments   = ["prod"]

  monthly_budget_usd  = var.workload_monthly_budget_usd
  budget_alert_emails = var.budget_alert_emails
}

# GitHub repo settings that the CI pipeline relies on: deployment
# environments locked to their branches, branch rulesets, and the Actions
# variables the workflows read. Requires GITHUB_TOKEN (e.g.
# `export GITHUB_TOKEN=$(gh auth token)`) with admin rights on the repo.

locals {
  github_repo_name = split("/", var.github_repo)[1]

  # GitHub environment => branch allowed to deploy to it.
  environment_branches = {
    dev  = "development"
    prod = "production"
  }

  # Check names as GitHub reports them (the jobs in .github/workflows/pr.yml).
  # 15368 is the GitHub Actions app, so only Actions can satisfy them.
  github_actions_app_id = 15368
}

# ---------------------------------------------------------------------------
# Environments: each deployable only from its own branch; prod needs approval.
# ---------------------------------------------------------------------------

resource "github_repository_environment" "this" {
  for_each = local.environment_branches

  repository  = local.github_repo_name
  environment = each.key

  # Solo maintainer: the reviewer is also the author, so self-review must be
  # allowed or prod deploys could never be approved.
  prevent_self_review = false
  can_admins_bypass   = true

  dynamic "reviewers" {
    for_each = contains(var.approval_environments, each.key) ? [1] : []
    content {
      users = [tonumber(var.github_owner_id)]
    }
  }

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "this" {
  for_each = local.environment_branches

  repository     = local.github_repo_name
  environment    = github_repository_environment.this[each.key].environment
  branch_pattern = each.value
}

# ---------------------------------------------------------------------------
# Branch rulesets: changes land on development/production only via PRs whose
# checks passed. master is updated by merging production (no checks there).
# ---------------------------------------------------------------------------

resource "github_repository_ruleset" "deploy_branch" {
  for_each = local.environment_branches

  name        = each.value
  repository  = local.github_repo_name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${each.value}"]
      exclude = []
    }
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count   = 0
      dismiss_stale_reviews_on_push     = false
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_review_thread_resolution = false
    }

    required_status_checks {
      strict_required_status_checks_policy = false

      required_check {
        context        = "fmt / validate / lint"
        integration_id = local.github_actions_app_id
      }

      required_check {
        context        = "backend: lint / typecheck / test"
        integration_id = local.github_actions_app_id
      }

      required_check {
        context        = "plan (${each.key})"
        integration_id = local.github_actions_app_id
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Actions variables read by the workflows. Variables, not secrets: none of
# these values are sensitive.
# ---------------------------------------------------------------------------

resource "github_actions_variable" "this" {
  for_each = {
    AWS_REGION          = var.region
    TF_STATE_BUCKET     = aws_s3_bucket.tfstate.bucket
    AWS_PLAN_ROLE_ARN   = aws_iam_role.gha_plan.arn
    AWS_DEPLOY_ROLE_ARN = aws_iam_role.gha_deploy.arn
  }

  repository    = local.github_repo_name
  variable_name = each.key
  value         = each.value
}

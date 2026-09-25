# Adopt GitHub settings that were created by hand before github.tf existed.
# Safe to delete this file once it has been applied.

import {
  for_each = toset(["dev", "prod"])
  to       = github_repository_environment.this[each.key]
  id       = "${local.github_repo_name}:${each.key}"
}

import {
  to = github_repository_ruleset.deploy_branch["dev"]
  id = "${local.github_repo_name}:23993343"
}

import {
  for_each = toset(["AWS_REGION", "TF_STATE_BUCKET", "AWS_PLAN_ROLE_ARN", "AWS_DEPLOY_ROLE_ARN"])
  to       = github_actions_variable.this[each.key]
  id       = "${local.github_repo_name}:${each.key}"
}

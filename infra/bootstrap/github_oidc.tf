# GitHub Actions authenticates to AWS with short-lived OIDC tokens, so no AWS
# keys are stored in GitHub.
#
# The OIDC provider is account-wide (one per URL). Other projects in this
# account should look it up with a data source rather than create their own.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  oidc_sub = "token.actions.githubusercontent.com:sub"
  oidc_aud = "token.actions.githubusercontent.com:aud"
}

# ---------------------------------------------------------------------------
# Plan role: read-only, used by PR checks and plans on the default branch.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "plan_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = local.oidc_aud
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = local.oidc_sub
      values = [
        "repo:${var.github_repo}:pull_request",
        "repo:${var.github_repo}:ref:refs/heads/${var.github_default_branch}",
      ]
    }
  }
}

resource "aws_iam_role" "gha_plan" {
  name                 = "${var.project}-gha-plan"
  description          = "GitHub Actions: terraform plan (read-only)"
  assume_role_policy   = data.aws_iam_policy_document.plan_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "gha_plan_readonly" {
  role       = aws_iam_role.gha_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Plans need to take (and release) the S3 state lock, so allow writing
# .tflock objects, and nothing else in the bucket.
data "aws_iam_policy_document" "gha_plan_state" {
  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
  }

  statement {
    sid       = "ReadState"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/*"]
  }

  statement {
    sid       = "ManageLockFiles"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/*.tflock"]
  }
}

resource "aws_iam_role_policy" "gha_plan_state" {
  name   = "terraform-state"
  role   = aws_iam_role.gha_plan.id
  policy = data.aws_iam_policy_document.gha_plan_state.json
}

# ---------------------------------------------------------------------------
# Deploy role: terraform apply, only from jobs bound to a GitHub environment
# (so prod can be gated by required reviewers).
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = local.oidc_aud
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = local.oidc_sub
      values   = [for env in var.deploy_environments : "repo:${var.github_repo}:environment:${env}"]
    }
  }
}

resource "aws_iam_role" "gha_deploy" {
  name                 = "${var.project}-gha-deploy"
  description          = "GitHub Actions: terraform apply for ${var.project} environments"
  assume_role_policy   = data.aws_iam_policy_document.deploy_trust.json
  max_session_duration = 3600
}

# PowerUserAccess covers the app's services (Lambda, API Gateway, DynamoDB,
# Cognito, S3, CloudWatch, ...) but excludes IAM. IAM is granted separately
# below, scoped to this project's resource names.
resource "aws_iam_role_policy_attachment" "gha_deploy_poweruser" {
  role       = aws_iam_role.gha_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

data "aws_iam_policy_document" "gha_deploy_iam" {
  statement {
    sid     = "ManageProjectIamRolesAndPolicies"
    actions = ["iam:*"]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project}-*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.project}-*",
    ]
  }

  # The pattern above also matches the CI roles themselves; stop the deploy
  # role from editing its own (or the plan role's) permissions.
  statement {
    sid     = "DenyEditingCiRoles"
    effect  = "Deny"
    actions = ["iam:*"]
    resources = [
      aws_iam_role.gha_plan.arn,
      aws_iam_role.gha_deploy.arn,
    ]
  }

  statement {
    sid     = "ProtectOidcProvider"
    effect  = "Deny"
    actions = ["iam:*OpenIDConnectProvider*"]
    resources = [
      aws_iam_openid_connect_provider.github.arn,
    ]
  }

  # PowerUserAccess allows s3:*, so explicitly protect the state bucket's
  # configuration. Reading/writing state objects stays allowed.
  statement {
    sid    = "ProtectStateBucket"
    effect = "Deny"
    actions = [
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
      "s3:PutBucketVersioning",
      "s3:PutLifecycleConfiguration",
      "s3:PutEncryptionConfiguration",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketOwnershipControls",
    ]
    resources = [aws_s3_bucket.tfstate.arn]
  }
}

resource "aws_iam_role_policy" "gha_deploy_iam" {
  name   = "project-iam-and-guardrails"
  role   = aws_iam_role.gha_deploy.id
  policy = data.aws_iam_policy_document.gha_deploy_iam.json
}

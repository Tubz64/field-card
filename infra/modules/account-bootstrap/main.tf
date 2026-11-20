# Everything an account needs before CI can deploy into it: a Terraform state
# bucket, GitHub's OIDC provider, a read-only plan role, a deploy role, and a
# cost budget. Applied by hand from infra/bootstrap, once per account.

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id

  oidc_sub = "token.actions.githubusercontent.com:sub"
  oidc_aud = "token.actions.githubusercontent.com:aud"

  # The repo uses GitHub's immutable OIDC subject format, which embeds the
  # owner and repo IDs: repo:<owner>@<owner_id>/<repo>@<repo_id>:<context>.
  # Check with: gh api repos/<owner>/<repo>/actions/oidc/customization/sub
  oidc_sub_prefix = format(
    "repo:%s@%s/%s@%s",
    split("/", var.github_repo)[0], var.github_owner_id,
    split("/", var.github_repo)[1], var.github_repo_id,
  )
}

# ---------------------------------------------------------------------------
# Terraform state bucket (versioned, encrypted, TLS-only, S3-native locking).
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project}-tfstate-${local.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 10
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.tfstate]
}

data "aws_iam_policy_document" "tfstate_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.tfstate.arn,
      "${aws_s3_bucket.tfstate.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  policy = data.aws_iam_policy_document.tfstate_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.tfstate]
}

# ---------------------------------------------------------------------------
# GitHub OIDC: short-lived tokens, so no AWS keys are stored in GitHub. The
# provider is account-wide; anything else in this account should look it up
# with a data source rather than create another.
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Plan role: read-only, plus taking/releasing the state lock.
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
      values   = [for ctx in var.plan_subject_contexts : "${local.oidc_sub_prefix}:${ctx}"]
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

# Deploy role: terraform apply, only from jobs bound to this account's GitHub
# environment(s), so prod stays behind its required reviewer.
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
      values   = [for env in var.deploy_environments : "${local.oidc_sub_prefix}:environment:${env}"]
    }
  }
}

resource "aws_iam_role" "gha_deploy" {
  name                 = "${var.project}-gha-deploy"
  description          = "GitHub Actions: terraform apply (${join(", ", var.deploy_environments)})"
  assume_role_policy   = data.aws_iam_policy_document.deploy_trust.json
  max_session_duration = 3600
}

# PowerUserAccess covers the app's services but excludes IAM, which is granted
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
      "arn:aws:iam::${local.account_id}:role/${var.project}-*",
      "arn:aws:iam::${local.account_id}:policy/${var.project}-*",
    ]
  }

  # The pattern above also matches the CI roles themselves.
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
    sid       = "ProtectOidcProvider"
    effect    = "Deny"
    actions   = ["iam:*OpenIDConnectProvider*"]
    resources = [aws_iam_openid_connect_provider.github.arn]
  }

  # PowerUserAccess allows s3:*, so protect the state bucket's configuration.
  # Reading and writing state objects stays allowed.
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

# ---------------------------------------------------------------------------
# Cost budget: alerts on actual spend passing 80%, and forecast passing 100%.
# ---------------------------------------------------------------------------

resource "aws_budgets_budget" "monthly" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }
}

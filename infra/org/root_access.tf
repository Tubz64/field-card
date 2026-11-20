# Centralised root access: member accounts have no root credentials at all.
# For the rare task that needs root (e.g. unlocking a misconfigured S3 bucket
# policy), the management account starts a short root session with
# `aws sts assume-root`. Accounts created by Organizations start without root
# credentials, so there is nothing to delete.
resource "aws_iam_organizations_features" "root_access" {
  enabled_features = [
    "RootCredentialsManagement",
    "RootSessions",
  ]

  depends_on = [aws_organizations_organization.this]
}

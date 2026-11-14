# The organisation already exists (created by hand in 2018), so it is imported
# rather than created. Destroying it would remove every member account.
import {
  to = aws_organizations_organization.this
  id = var.organization_id
}

resource "aws_organizations_organization" "this" {
  feature_set = "ALL"

  # The first five were already enabled before this config existed; keep them
  # or the import would turn them off. iam.amazonaws.com is new: it is needed
  # for centralised root access (root_access.tf).
  aws_service_access_principals = [
    "compute-optimizer.amazonaws.com",
    "config.amazonaws.com",
    "cost-optimization-hub.bcm.amazonaws.com",
    "fms.amazonaws.com",
    "iam.amazonaws.com",
    "sso.amazonaws.com",
  ]

  enabled_policy_types = ["SERVICE_CONTROL_POLICY"]

  lifecycle {
    prevent_destroy = true
  }
}

# Workload accounts live in their own OU so guardrails (scp.tf) apply to them
# but never to the management account.
resource "aws_organizations_organizational_unit" "workloads" {
  name      = "workloads"
  parent_id = aws_organizations_organization.this.roots[0].id
}

# Created inside the organisation, so they never get a root password or a card
# on file. The management account reaches them by assuming
# OrganizationAccountAccessRole, which AWS creates in each new account.
resource "aws_organizations_account" "workload" {
  for_each = var.account_emails

  name      = "${var.project}-${each.key}"
  email     = each.value
  parent_id = aws_organizations_organizational_unit.workloads.id

  role_name                  = "OrganizationAccountAccessRole"
  iam_user_access_to_billing = "DENY"

  # Removing an account from this config should never close it. Closing is a
  # deliberate, manual step (and frees nothing: closed emails can't be reused).
  close_on_deletion = false

  lifecycle {
    prevent_destroy = true
    # AWS doesn't return these after creation, so they would show as drift.
    ignore_changes = [role_name, iam_user_access_to_billing]
  }
}

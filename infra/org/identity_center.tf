# IAM Identity Center: one login (the access portal) for every account in the
# organisation. The organisation instance itself was enabled in the console
# (eu-west-2), as AWS has no API for that; everything else is here.
data "aws_ssoadmin_instances" "this" {}

locals {
  sso_instance_arn  = one(data.aws_ssoadmin_instances.this.arns)
  identity_store_id = one(data.aws_ssoadmin_instances.this.identity_store_ids)

  # Every account a permission set is assigned in: management + workloads.
  all_account_ids = merge(
    { management = var.management_account_id },
    { for env, account in aws_organizations_account.workload : env => account.id },
  )

  permission_sets = {
    admin = {
      description      = "Full admin. For setup and break-glass work."
      managed_policy   = "arn:aws:iam::aws:policy/AdministratorAccess"
      session_duration = "PT4H"
    }
    read-only = {
      description      = "Look, don't touch. The everyday default."
      managed_policy   = "arn:aws:iam::aws:policy/ReadOnlyAccess"
      session_duration = "PT12H"
    }
  }

  # Every (permission set, account) pair, for the admins group.
  assignments = {
    for pair in setproduct(keys(local.permission_sets), keys(local.all_account_ids)) :
    "${pair[0]}/${pair[1]}" => { permission_set = pair[0], account_id = local.all_account_ids[pair[1]] }
  }
}

resource "aws_ssoadmin_permission_set" "this" {
  for_each = local.permission_sets

  name             = "${var.project}-${each.key}"
  description      = each.value.description
  instance_arn     = local.sso_instance_arn
  session_duration = each.value.session_duration
}

resource "aws_ssoadmin_managed_policy_attachment" "this" {
  for_each = local.permission_sets

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.key].arn
  managed_policy_arn = each.value.managed_policy
}

resource "aws_identitystore_group" "admins" {
  identity_store_id = local.identity_store_id
  display_name      = "${var.project}-admins"
  description       = "Admin and read-only access to every account in the organisation."
}

resource "aws_identitystore_user" "admin" {
  identity_store_id = local.identity_store_id

  user_name    = var.sso_admin.user_name
  display_name = "${var.sso_admin.given_name} ${var.sso_admin.family_name}"

  name {
    given_name  = var.sso_admin.given_name
    family_name = var.sso_admin.family_name
  }

  emails {
    value   = var.sso_admin.email
    primary = true
  }
}

resource "aws_identitystore_group_membership" "admin" {
  identity_store_id = local.identity_store_id
  group_id          = aws_identitystore_group.admins.group_id
  member_id         = aws_identitystore_user.admin.user_id
}

resource "aws_ssoadmin_account_assignment" "admins" {
  for_each = local.assignments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.permission_set].arn
  principal_type     = "GROUP"
  principal_id       = aws_identitystore_group.admins.group_id
  target_type        = "AWS_ACCOUNT"
  target_id          = each.value.account_id

  # The policy must be on the permission set before it is provisioned.
  depends_on = [aws_ssoadmin_managed_policy_attachment.this]
}

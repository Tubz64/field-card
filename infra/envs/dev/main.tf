locals {
  name_prefix = "${var.project}-${var.environment}"

  # The only per-environment differences.
  self_signup_enabled = true  # false = invite-only (see infra/README.md)
  protect_data        = false # deletion protection on; buckets keep photos on destroy
}

module "auth" {
  source = "../../modules/auth"

  name_prefix         = local.name_prefix
  self_signup_enabled = local.self_signup_enabled
  deletion_protection = local.protect_data
}

module "database" {
  source = "../../modules/database"

  name_prefix         = local.name_prefix
  deletion_protection = local.protect_data
}

module "photos" {
  source = "../../modules/photos"

  name_prefix   = local.name_prefix
  force_destroy = !local.protect_data
}

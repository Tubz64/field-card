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

module "api" {
  source = "../../modules/api"

  name_prefix = local.name_prefix
  # Built by `npm run build` in backend/ (CI runs it before plan/apply).
  source_dir = "${path.root}/../../../backend/dist/api"
  route_keys = jsondecode(file("${path.root}/../../../backend/src/api/routes.json"))

  table_name         = module.database.table_name
  table_arn          = module.database.table_arn
  photos_bucket_name = module.photos.bucket_name
  photos_bucket_arn  = module.photos.bucket_arn
  user_pool_endpoint = module.auth.user_pool_endpoint
  app_client_id      = module.auth.app_client_id
}

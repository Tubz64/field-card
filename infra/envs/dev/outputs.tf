output "environment" {
  value = var.environment
}

# Consumed by the Expo app config and the API Lambdas.
output "region" {
  value = var.region
}

output "user_pool_id" {
  value = module.auth.user_pool_id
}

output "user_pool_client_id" {
  value = module.auth.app_client_id
}

output "table_name" {
  value = module.database.table_name
}

output "photos_bucket" {
  value = module.photos.bucket_name
}

output "api_url" {
  value = module.api.api_url
}

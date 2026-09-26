output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "user_pool_endpoint" {
  description = "Token issuer host for JWT validation (prefix with https://)."
  value       = aws_cognito_user_pool.this.endpoint
}

output "app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

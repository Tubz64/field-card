output "api_url" {
  value = aws_apigatewayv2_api.this.api_endpoint
}

output "function_name" {
  value = aws_lambda_function.api.function_name
}

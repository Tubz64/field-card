variable "name_prefix" {
  description = "Prefix for resource names, e.g. pawpers-dev."
  type        = string
}

variable "source_dir" {
  description = "Directory holding the built Lambda bundle (backend/dist/api)."
  type        = string
}

variable "route_keys" {
  description = "API Gateway route keys, e.g. \"GET /pets\". Read from backend/src/api/routes.json."
  type        = list(string)
}

variable "table_name" {
  type = string
}

variable "table_arn" {
  type = string
}

variable "photos_bucket_name" {
  type = string
}

variable "photos_bucket_arn" {
  type = string
}

variable "user_pool_endpoint" {
  description = "Cognito user pool endpoint (issuer host, without https://)."
  type        = string
}

variable "app_client_id" {
  description = "Cognito app client whose tokens the API accepts."
  type        = string
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "throttling_burst_limit" {
  type    = number
  default = 20
}

variable "throttling_rate_limit" {
  description = "Steady-state requests per second across the whole API."
  type        = number
  default     = 10
}

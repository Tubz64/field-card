variable "name_prefix" {
  description = "Prefix for resource names, e.g. pawpers-dev."
  type        = string
}

variable "self_signup_enabled" {
  description = "Allow anyone to sign up from the app. When false the pool is invite-only."
  type        = bool
}

variable "deletion_protection" {
  description = "Block deletion of the user pool."
  type        = bool
}

variable "refresh_token_validity_days" {
  description = "How long a device stays signed in without being used."
  type        = number
  default     = 90
}

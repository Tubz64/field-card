variable "name_prefix" {
  description = "Prefix for the bucket name, e.g. pawpers-dev."
  type        = string
}

variable "force_destroy" {
  description = "Allow Terraform to delete the bucket even when it holds photos."
  type        = bool
}

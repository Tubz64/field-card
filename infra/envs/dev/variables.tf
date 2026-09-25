variable "project" {
  description = "Project name, used as the prefix for every resource name."
  type        = string
  default     = "pawpers"
}

variable "environment" {
  description = "Environment name, used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "Primary AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "aws_account_id" {
  description = "The only AWS account this config may touch (guards against applying with the wrong credentials)."
  type        = string
  default     = "455967503530"
}

variable "github_repo" {
  description = "GitHub repository (owner/name), recorded in resource tags."
  type        = string
  default     = "Tubz64/field-card"
}

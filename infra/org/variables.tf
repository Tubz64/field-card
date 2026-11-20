variable "project" {
  description = "Project name, used as the prefix for account and policy names."
  type        = string
  default     = "pawpers"
}

variable "region" {
  description = "Primary AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "management_account_id" {
  description = "The organisation's management account. The only account this config may run against."
  type        = string
  default     = "455967503530"
}

variable "organization_id" {
  description = "ID of the existing organisation, imported into state."
  type        = string
  default     = "o-rhml3cx39i"
}

# Set the account emails in terraform.tfvars (gitignored); the repo is public.
variable "account_emails" {
  description = "Root email address for each workload account, keyed by environment (dev, prod). Must be unique across all AWS accounts, including closed ones."
  type        = map(string)

  validation {
    condition     = toset(keys(var.account_emails)) == toset(["dev", "prod"])
    error_message = "Set exactly the keys \"dev\" and \"prod\"."
  }
}

variable "allowed_regions" {
  description = "Regions workload accounts may use. us-east-1 is needed for global services' regional parts (ACM certs for CloudFront, billing)."
  type        = list(string)
  default     = ["eu-west-2", "us-east-1"]
}

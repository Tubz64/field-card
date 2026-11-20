# The state bucket already exists (created by infra/bootstrap), so this root
# uses remote state from the first init. It stays in the management account.
terraform {
  backend "s3" {
    bucket       = "pawpers-tfstate-455967503530"
    key          = "org/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

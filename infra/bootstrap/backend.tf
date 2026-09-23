# First apply runs with local state, because the bucket doesn't exist yet.
# After it succeeds, uncomment this block and run:
#   terraform init -migrate-state
# See README.md.

terraform {
  backend "s3" {
    bucket       = "pawpers-tfstate-455967503530"
    key          = "bootstrap/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

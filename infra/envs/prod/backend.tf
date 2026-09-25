terraform {
  backend "s3" {
    bucket       = "pawpers-tfstate-455967503530"
    key          = "envs/prod/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

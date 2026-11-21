terraform {
  backend "s3" {
    bucket       = "pawpers-tfstate-427155357656"
    key          = "envs/dev/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

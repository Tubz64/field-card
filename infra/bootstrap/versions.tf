terraform {
  required_version = "~> 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }

    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }
}

# Token comes from GITHUB_TOKEN.
provider "github" {
  owner = split("/", var.github_repo)[0]
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      Project   = var.project
      Stack     = "bootstrap"
      ManagedBy = "terraform"
      Repo      = var.github_repo
    }
  }
}

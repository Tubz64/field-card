# Single table for all app data. Items for one user share a partition, so a
# single Query returns the user's pets and their vaccinations:
#
#   PK            SK                          item
#   USER#<sub>    PET#<petId>                 pet (name, species, dob, chip, photoKey, photoUpdatedAt, ...)
#   USER#<sub>    PET#<petId>#VAX#<vaxId>     vaccination (type, vet, given, expires)
#
# Encrypted at rest with the AWS-owned key (free); a customer-managed KMS
# key would add ~$1/month per env for no practical gain here.
resource "aws_dynamodb_table" "this" {
  name                        = var.name_prefix
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "PK"
  range_key                   = "SK"
  deletion_protection_enabled = var.deletion_protection

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

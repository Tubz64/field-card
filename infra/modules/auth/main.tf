# Cognito user pool for app sign-in. Users sign in with email + password
# (SRP, so the password never leaves the device); every API request carries
# the user's token and all data is keyed by its `sub`.
resource "aws_cognito_user_pool" "this" {
  name                = var.name_prefix
  user_pool_tier      = "ESSENTIALS"
  deletion_protection = var.deletion_protection ? "ACTIVE" : "INACTIVE"
  mfa_configuration   = "OFF"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 10
    require_lowercase                = true
    require_uppercase                = false
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Self-sign-up off = invite-only: users are created with
  # `aws cognito-idp admin-create-user`, which emails a temporary password.
  admin_create_user_config {
    allow_admin_create_user_only = !var.self_signup_enabled

    invite_message_template {
      email_subject = "Your Pawpers invite"
      email_message = "You have been invited to Pawpers. Sign in with {username} and temporary password {####} within 7 days."
      sms_message   = "Pawpers: sign in with {username} and temporary password {####}."
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Pawpers verification code"
    email_message        = "Your Pawpers verification code is {####}."
  }

  # Cognito's built-in sender: fine for development and small invite lists
  # (50 emails/day). Switch to SES before opening sign-up publicly.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
}

# Public client for the Expo app: no client secret (it can't be kept secret
# on a phone), SRP sign-in only, long-lived refresh tokens so people aren't
# signed out between trips.
resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.name_prefix}-app"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
  supported_identity_providers  = ["COGNITO"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

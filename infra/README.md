# infra

| Path | What | Applied by |
|---|---|---|
| `bootstrap/` | State bucket, GitHub OIDC + CI roles, GitHub repo settings | Hand, once (see its README) |
| `modules/auth` | Cognito user pool + Expo app client | via envs |
| `modules/database` | DynamoDB single table (`PK`/`SK`) | via envs |
| `modules/photos` | Private S3 bucket for pet photos | via envs |
| `envs/dev`, `envs/prod` | Per-environment roots wiring the modules together | CI only |

`development` deploys to `dev` on every merge. `production` deploys to `prod`
after approval, and is promoted from `development` at milestones.

## Per-environment settings

The only differences live in `locals` at the top of `envs/<env>/main.tf`:

| Setting | dev | prod |
|---|---|---|
| `self_signup_enabled` | `true` | `false` (invite-only) |
| `protect_data` (deletion protection on the user pool and table; bucket not force-destroyed) | `false` | `true` |

## Inviting a user (invite-only envs)

Cognito emails the user a temporary password, valid for 7 days. They set a
new one at first sign-in. Invites are kept out of Terraform so no email
addresses end up in this public repo.

```bash
POOL=$(terraform -chdir=infra/envs/prod output -raw user_pool_id)
EMAIL=someone@example.com
aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

To open sign-up to everyone, set `self_signup_enabled = true` in
`envs/prod/main.tf`. It's an in-place update; existing users are unaffected.
Before doing that, move Cognito email to SES: the built-in sender is capped
at 50 emails a day.

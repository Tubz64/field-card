# infra/org

The AWS Organization, managed from the management account (`455967503530`).
Applied by hand: CI's roles are deliberately unable to touch Organizations.

| Resource | What |
|---|---|
| `aws_organizations_organization` | The existing organisation (`o-rhml3cx39i`), **imported**, not created. Adds trusted access for IAM. |
| `workloads` OU | Holds the workload accounts, so guardrails never touch the management account |
| `pawpers-dev`, `pawpers-prod` accounts | Created inside the organisation: no root password, no card, billing rolls up to management |
| `pawpers-guardrails` SCP | On the `workloads` OU: can't leave the organisation, and only `eu-west-2` + `us-east-1` (global services exempt) |
| Centralised root access | Member accounts have no root credentials. Root tasks use a short-lived `aws sts assume-root` session from management |
| IAM Identity Center | `pawpers-admin` (4h) and `pawpers-read-only` (12h) permission sets, a `pawpers-admins` group and its user, assigned to every account |

Everything is `prevent_destroy`, and accounts have `close_on_deletion = false`.
Closing an account is a deliberate manual step, and its email can never be
reused.

## Apply

```bash
cd infra/org
cp terraform.tfvars.example terraform.tfvars   # set the two account emails
terraform init
terraform plan -out tfplan    # expect: 1 to import, 6 to add, 1 to change, 0 to destroy
terraform apply tfplan
terraform output account_ids
```

Account creation takes a minute or two per account. There's no password to
set, and AWS may not send a welcome email to the new accounts' addresses.

| Account | ID |
|---|---|
| `pawpers-dev` | 427155357656 |
| `pawpers-prod` | 341341093645 |

## Signing in (Identity Center)

The organisation instance (eu-west-2) was enabled once in the console. AWS has
no API for that step. Everything else is in `identity_center.tf`.

Access portal: `terraform output sso_portal_url`.

**First sign-in.** Users created by API don't get an invitation email by
default. Either:

- In IAM Identity Center go to Settings → Authentication → Standard
  authentication, and turn on **"Send email OTP for users created from API"**,
  or
- go to Users → the user → **Reset password** → "Send an email to the user".

Then set a password and register MFA.

**CLI.** Configure it with `aws configure sso`: use the portal URL, region
`eu-west-2`, and one profile per account/role, e.g. `pawpers-dev-admin`. Then
`aws sso login --profile pawpers-dev-admin`.

**Fallback.** From management credentials, assume
`arn:aws:iam::<account-id>:role/OrganizationAccountAccessRole`, the role AWS
creates in every account the organisation makes.

## Next steps (follow-up PRs)

1. Once the portal works, delete the long-lived access keys on the management
   account's `toby` IAM user, and use `aws sso login` instead.
2. Bootstrap `pawpers-dev` and `pawpers-prod`: state bucket, GitHub OIDC and CI
   roles in each, and repoint the GitHub environments.
3. Redeploy the stacks into the new accounts, then tear down the old ones in
   the management account.
4. DNS: the `pawpers.co.uk` zone in prod, `dev.pawpers.co.uk` in dev, with NS
   delegation. The domain registration stays in management.
5. SES for Cognito emails from `no-reply@pawpers.co.uk`.

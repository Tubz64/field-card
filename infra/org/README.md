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

Account creation takes a minute or two per account. The emails get a welcome
message from AWS. There's no password to set.

## Getting into the new accounts

Until IAM Identity Center is set up, assume the role AWS creates in each
account, from the management account:

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::<account-id>:role/OrganizationAccountAccessRole \
  --role-session-name toby
```

Or add a profile to `~/.aws/config`:

```ini
[profile pawpers-dev]
role_arn       = arn:aws:iam::<dev-account-id>:role/OrganizationAccountAccessRole
source_profile = default
region         = eu-west-2
```

## Next steps (follow-up PRs)

1. **IAM Identity Center:** enable the organisation instance in the console
   (the one click that can't be done by API). Then permission sets, a user and
   account assignments go in this config. That replaces the long-lived IAM
   user keys on the management account.
2. Bootstrap `pawpers-dev` and `pawpers-prod`: state bucket, GitHub OIDC and CI
   roles in each, and repoint the GitHub environments.
3. Redeploy the stacks into the new accounts, then tear down the old ones in
   the management account.
4. DNS: the `pawpers.co.uk` zone in prod, `dev.pawpers.co.uk` in dev, with NS
   delegation. The domain registration stays in management.
5. SES for Cognito emails from `no-reply@pawpers.co.uk`.

# infra/bootstrap

One-time setup, applied by hand with your own AWS credentials and a GitHub
token (see step 3). It creates the pieces that CI needs before CI can run:

| Resource | Name |
|---|---|
| Terraform state bucket (versioned, encrypted, TLS-only, S3-native locking) | `pawpers-tfstate-<account-id>` |
| GitHub Actions OIDC provider (account-wide) | `token.actions.githubusercontent.com` |
| CI plan role: `ReadOnlyAccess` + state read/lock; PRs and `master` | `pawpers-gha-plan` |
| CI deploy role: `PowerUserAccess` + IAM scoped to `pawpers-*`; GitHub environments `dev`/`prod` only | `pawpers-gha-deploy` |
| Monthly cost budget with email alerts (optional) | `pawpers-monthly` |
| GitHub environments, branch rulesets, Actions variables | see step 3 |

After this, all other infrastructure is deployed by GitHub Actions.

## Workload accounts (`workload_accounts.tf`)

The same config also bootstraps `pawpers-dev` (427155357656) and `pawpers-prod`
(341341093645), the accounts created in `infra/org`. It uses the
`modules/account-bootstrap` module and reaches each account through
`OrganizationAccountAccessRole`. Each account gets its own:

| Resource | Name |
|---|---|
| State bucket | `pawpers-tfstate-<account-id>` |
| GitHub OIDC provider | `token.actions.githubusercontent.com` |
| Plan role (any PR, read-only) | `pawpers-gha-plan` |
| Deploy role (only its own GitHub environment: `dev` or `prod`) | `pawpers-gha-deploy` |
| Budget (`workload_monthly_budget_usd`, default $10) | `pawpers-monthly` |

So a dev deploy job can't get prod credentials, and each environment's state
sits in its own account. `terraform output workload_accounts` lists the bucket
and role ARNs.

Run with management-account credentials (`AWS_PROFILE=mgmt-admin`) plus
`GITHUB_TOKEN` as below.

**Migration in progress:** CI still uses the management account's bucket and
roles above until the envs are moved to the workload accounts. After that,
the management-account CI pieces get removed.

## 1. Apply (local state)

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # add your budget alert email
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

The provider's `allowed_account_ids` refuses to run against any account other
than `455967503530`.

## 2. Move bootstrap state into the bucket

Uncomment the `backend "s3"` block in `backend.tf`, then:

```bash
terraform init -migrate-state   # answer "yes"
rm terraform.tfstate terraform.tfstate.backup
terraform plan                  # should report no changes
```

## 3. GitHub settings

The same config manages the repo settings CI depends on (`github.tf`), so
applying it keeps them in sync. Nothing is set by hand in the GitHub UI.

| Setting | Value |
|---|---|
| Environments | `dev` deployable only from `development`; `prod` only from `production`, with the repo owner as required reviewer |
| Branch rulesets | `development` / `production`: PR required, no force-push or delete, checks `fmt / validate / lint` and `plan (<env>)` must pass |
| Actions variables (not secrets; none are sensitive) | `AWS_REGION`, `TF_STATE_BUCKET`, `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN` |

The GitHub provider reads a token with admin rights on the repo from
`GITHUB_TOKEN`, so set it before any plan or apply here:

```bash
export GITHUB_TOKEN=$(gh auth token)   # PowerShell: $env:GITHUB_TOKEN = gh auth token
```

The `development` and `production` branches must already exist.

## Notes

- If the GitHub repo is renamed, update `github_repo` and re-apply. The
  roles' trust policies match on the repo name.
- The state bucket has `prevent_destroy`. Tearing it down is deliberately
  manual.

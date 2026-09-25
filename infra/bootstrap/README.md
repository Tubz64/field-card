# infra/bootstrap

One-time setup, applied by hand with your own AWS credentials. It creates the
pieces that CI needs before CI can run:

| Resource | Name |
|---|---|
| Terraform state bucket (versioned, encrypted, TLS-only, S3-native locking) | `pawpers-tfstate-<account-id>` |
| GitHub Actions OIDC provider (account-wide) | `token.actions.githubusercontent.com` |
| CI plan role: `ReadOnlyAccess` + state read/lock; PRs and `master` | `pawpers-gha-plan` |
| CI deploy role: `PowerUserAccess` + IAM scoped to `pawpers-*`; GitHub environments `dev`/`prod` only | `pawpers-gha-deploy` |
| Monthly cost budget with email alerts (optional) | `pawpers-monthly` |

After this, all other infrastructure is deployed by GitHub Actions.

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

## 3. Configure GitHub

Create the environments and store the role ARNs as repo variables. These
are variables, not secrets, because none of the values are sensitive:

```bash
REPO=Tubz64/field-card
gh api -X PUT repos/$REPO/environments/dev
gh api -X PUT repos/$REPO/environments/prod
gh variable set AWS_REGION          -R $REPO -b "$(terraform output -raw region)"
gh variable set TF_STATE_BUCKET     -R $REPO -b "$(terraform output -raw state_bucket)"
gh variable set AWS_PLAN_ROLE_ARN   -R $REPO -b "$(terraform output -raw plan_role_arn)"
gh variable set AWS_DEPLOY_ROLE_ARN -R $REPO -b "$(terraform output -raw deploy_role_arn)"
```

Lock each environment to its branch, so only `development` can deploy to
`dev` and only `production` can deploy to `prod`:

```bash
for pair in dev:development prod:production; do
  env=${pair%%:*}; branch=${pair#*:}
  gh api -X PUT repos/$REPO/environments/$env --input - <<EOF
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
EOF
  gh api -X POST repos/$REPO/environments/$env/deployment-branch-policies -f name=$branch -f type=branch
done
```

Then add required reviewers to the `prod` environment in the repo settings
(Settings → Environments → prod).

## Notes

- If the GitHub repo is renamed, update `github_repo` and re-apply. The
  roles' trust policies match on the repo name.
- The state bucket has `prevent_destroy`. Tearing it down is deliberately
  manual.

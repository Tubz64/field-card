# CLAUDE.md

## What this is
**Pawpers** (paw + papers; formerly "Field Card") — a pet vaccination wallet,
the first piece of a bigger pet-travel app. AWS resource prefix: `pawpers`
(e.g. `pawpers-dev-…`). The prototype `index.html` and the GitHub repo name
still say "Field Card"/`field-card`.
Long-term goal: solve two problems for UK dog owners — (1) always having proof of
vaccination on hand, and (2) understanding UK → EU pet travel requirements
(starting with France and Spain).

Currently built: just the vaccination wallet. The travel requirement checker
(Animal Health Certificate timelines, rabies vaccine sequencing, tapeworm
treatment rules) has NOT been built yet — that's the next major feature.

## Direction (decided 2026-09-23)
`index.html` is the **visual prototype** only. The real product is a phone app
with an AWS backend. Priority order:
1. Get the vaccination wallet working end-to-end — Expo app ↔ API ↔ storage —
   so it can be tested on a real phone against a deployed `dev` stack.
2. Only then build the travel requirement checker (see Roadmap).

Decisions:
- **Client: Expo (React Native + TypeScript)** for iOS + Android. Test via
  Expo Go on a physical phone; iOS builds via EAS Build (dev machine is
  Windows, no Mac). Chosen over a PWA for native expiry-reminder
  notifications and reliable offline access (proof of vaccination is needed
  at ports/borders with no signal — keep a local cache on the device).
- **Backend: AWS serverless**, defined in **Terraform** (owner is a DevOps
  engineer; Terraform preferred over CDK):
  - Cognito user pool — sign-in from day one; all data is scoped per user.
  - API Gateway HTTP API + Lambda (Node/TypeScript) — REST API.
  - DynamoDB, single table (user → pets → vaccinations).
  - S3 for pet photos (later: scanned certificates), uploaded via presigned
    URLs. Photos are no longer stored as base64 inside the record.
- AWS: account 455967503530, region **eu-west-2** (London).
- Test against a real deployed `dev` stack rather than local AWS emulation.
- **Automate everything** — no click-ops, no long-lived AWS keys:
  - Terraform remote state in S3 with native S3 locking (`use_lockfile`, no
    DynamoDB lock table). Pin the Terraform and AWS provider versions to the
    latest releases at scaffold time, and bump them deliberately.
  - `infra/bootstrap` (applied once by hand, see its README) creates the
    state bucket `pawpers-tfstate-455967503530`, the account's GitHub OIDC
    provider, and two CI roles: `pawpers-gha-plan` (read-only, PRs) and
    `pawpers-gha-deploy` (GitHub environments only). The OIDC provider is
    account-wide — other projects should reference it with a data source,
    not create another. Everything else goes through CI.
  - GitHub Actions (repo: github.com/Tubz64/field-card): on PR → fmt,
    validate, lint, tests, `terraform plan`; on merge to `master` → build
    Lambdas (esbuild) and `terraform apply` to `dev`. `prod` later, gated by
    a manual approval.
  - AWS access from CI via GitHub OIDC → IAM role only.
  - Mobile: EAS Build / EAS Update driven from CI once the app exists.
- Planned layout: `app/` (Expo), `backend/` (Lambda TypeScript source),
  `infra/` (Terraform: `bootstrap/`, reusable `modules/`, per-env roots
  `envs/dev`, `envs/prod`), `.github/workflows/`; `index.html`
  stays as the design reference — reuse its palette tokens and typefaces
  (Fraunces + Inter) in the app.
- No existing user data to migrate: prototype localStorage held test data only.

## Prototype stack (index.html)
Single self-contained `index.html` file. No build step, no framework, no
dependencies except two Google Fonts loaded via CDN link tag (Fraunces for
headings, Inter for body). Everything — markup, CSS, JS — lives in this one file.

Data persistence: browser `localStorage` only (key: `field-card-pets-v1`).
No backend, no sync across devices. All storage calls are wrapped in try/catch.

## Commands
No build/install needed. Open `index.html` directly in a browser, or serve it
with any static server, e.g.:
```bash
python3 -m http.server 8000
```

## Architecture
- `state = { pets: [], activeId: null }` is the single source of truth, held in
  a JS variable and mirrored to localStorage on every mutation via `save()`.
- Each pet: `{ id, name, species, breed, dob, chip, photo, vaccines: [] }`.
  `photo` is a base64 data URL, resized client-side (max 240px, JPEG q=0.82)
  via `resizeImage()` before storing, to keep localStorage usage down.
- Each vaccine record: `{ id, type, vet, given, expires }`.
- `statusFor(vaccine)` derives green/amber(≤30 days)/red(expired)/none status
  from `expires`. `overallStatus(pet)` takes the worst status across a pet's
  vaccines for the summary badge.
- UI is rendered imperatively via a single `render()` function that rebuilds
  the pet tab bar and content area from `state` — no framework, no virtual DOM.
- Add/edit pet uses a modal overlay (`openPetModal`), shared between the two
  flows via an `isNew` flag.

## Conventions
- Design tokens are CSS custom properties on `:root` (see top of `<style>`):
  a moss-green / paper-cream "field notebook" palette. A dark-mode variant is
  defined under `@media (prefers-color-scheme: dark)` and mirrored under
  `:root[data-theme="dark"]` — keep both in sync if the palette changes.
- Typefaces: 'Fraunces' (serif) for headings/section labels, 'Inter' (sans)
  for body and UI text. Don't introduce a third typeface.
- All user-supplied text is passed through `escapeHtml()` before being
  inserted into template strings — keep doing this for anything new.
- Microchip numbers are UK/EU 15-digit ISO format (placeholder example:
  933012400146699).

## Gotchas
- This file is also a published Claude.ai Artifact. If editing outside this
  repo, keep in mind there's a synced copy at the Artifact link — changes
  made in one place don't automatically propagate to the other.
- The prototype's localStorage holds test data only, so the move to the
  AWS backend needs no data migration.

## Roadmap (not yet built)
1. Travel requirement checker: UK → France/Spain first.
   - Animal Health Certificate (AHC): must be issued within 10 days of travel.
   - Rabies vaccine: must be ≥21 days before travel (first-time vaccination;
     different rules if the pet already had rabies vaccination history).
   - Tapeworm treatment: only required for certain return/onward legs
     (e.g. Ireland, Finland, Norway, Malta), not for France/Spain directly.
   - UI: user enters destination + travel date, app back-calculates deadlines
     and shows a "what's missing" checklist.
2. Vet finder for AHC-authorized vets (static list to start).
3. Multi-pet household support is already in place; return-journey rules
   (UK re-entry requirements) are not.

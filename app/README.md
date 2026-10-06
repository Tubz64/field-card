# app

The Pawpers phone app: Expo SDK 57, React Native, TypeScript and Expo
Router. The same code runs on iOS, Android and the web.

## Run it

```bash
npm ci
npm run configure   # writes .env.local with the dev pool, client and API (needs AWS CLI credentials)
npm run web         # in a browser at http://localhost:8081
npm start           # scan the QR code with Expo Go on your phone
```

Dev allows self-sign-up: tap **Create an account**, enter first name,
surname, email and password, and Cognito emails you a code. The first name
(`given_name`) is what the app greets you by. Prod is invite-only (see
`infra/README.md`, which sets the name on the invite), so an invited user
signs in with the temporary password and is then asked to choose their own.

**Passwords** (Cognito policy, `infra/modules/auth`): 10 to 256 characters,
with at least one lowercase letter and one number. Capitals, symbols and
spaces are allowed but not required; no leading or trailing space. The app
shows these as a live checklist.

**Dates** are typed as DD-MM-YYYY (dashes are added automatically) and sent
to the API as YYYY-MM-DD.

The browser version needs `dev`'s CORS rules, which only allow
`http://localhost:8081`. Phones don't need CORS.

## Checks

```bash
npm run check    # eslint + tsc + vitest
npx expo-doctor  # dependency/config health for SDK 57
```

Add or upgrade Expo packages with `npx expo install <pkg>` (not `npm install`)
so versions match the SDK, and `npx expo install --fix` after Expo patch
releases. `AGENTS.md` has Expo's own guidance for AI tools.

`npm ci` should be free of warnings, with 0 vulnerabilities. Two things keep
it that way:

- **ESLint 10 with our own flat config** (`eslint.config.js`: typescript-eslint,
  React Hooks, Expo's env-var rules) instead of `eslint-config-expo`, whose
  React and import plugins still require the deprecated ESLint 9.
- **`overrides` in `package.json`:**
  - `uuid` → 11.1.1 (Expo's config tooling pulls in a vulnerable, deprecated `uuid@7`).
  - `decode-uri-component` → `vendor/decode-uri-component`, a CommonJS build of
    the fixed 0.5.0 (GHSA-vcc3-ghjq-m6fr). The real 0.5.0 is ESM-only, which
    breaks expo-router's `query-string@7`.
  - `eslint-plugin-expo` → the root ESLint (it wrongly lists ESLint 9 as a dependency).

  Drop each override once Expo's own dependencies catch up.

## How it's put together

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router: every file is a route). Sign-in screens and app screens sit behind `Stack.Protected` guards in `_layout.tsx`. |
| `src/lib/auth.ts`, `AuthProvider.tsx` | Cognito SRP sign-in, sign-up, invite (new-password) and reset flows via `amazon-cognito-identity-js`. |
| `src/lib/tokenStorage.ts` | Keeps tokens in SecureStore (keychain) on phones and localStorage on web, so you stay signed in. |
| `src/lib/api.ts`, `queries.ts` | API client plus React Query hooks. The pet list is persisted to device storage for 90 days, so records open with no signal. |
| `src/lib/status.ts` | Vaccination status (ported from the prototype) and photo-refresh reminders. Unit-tested. |
| `src/components/` | Shared UI in the prototype's palette (Fraunces + Inter, light and dark). |

**Offline:** the last synced pet list and photos (cached on disk by
`expo-image`, keyed on the upload time) are available with no connection.
Changes need a connection.

**Expiry reminders** (`src/lib/reminders.ts`, `notifications.ts`) are local
notifications, so they work in Expo Go. They fire 30 days before, 7 days
before and on the day a vaccination expires, at 9am, for the latest
vaccination of each type. They're rescheduled whenever the records change,
and cancelled on sign-out. Permission is asked for the first time there's
something to remind about. Phones only (there's no web support). They can
be turned off in Profile.

**Profile** (`src/app/profile.tsx`): edit name, change password, reminders
on/off, sign out, and **delete account**. Deleting calls `DELETE /account`,
which removes all data, photos and the Cognito user. Apple requires in-app
account deletion, and it covers the UK GDPR right to erasure.

**Breeds**: `src/data/breeds.json` is bundled, so suggestions work offline.
It's built from Wikidata (CC0): dog breeds with an FCI number or an AKC ID,
all cat and rabbit breeds, plus common UK crossbreeds (Cockapoo, Cavapoo,
etc.). Any text is still allowed. To refresh it, run
`node scripts/build-breeds.mjs` and commit the result.

**Rabies "valid from"**: shown when the vaccine is rabies. Until that date
the vaccination shows amber ("Valid in 12d"), as groundwork for the travel
checker.

**Photos** can be added in the add/edit pet form, or by tapping the photo on
a pet's page. They're cropped square and resized to 800 px JPEG on the
device, then uploaded straight to S3 with the presigned POST from the API.

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

Dev allows self-sign-up: tap **Create an account** and Cognito emails you a
code. Prod is invite-only, so an invited user signs in with the temporary
password and is then asked to choose their own.

The browser version needs `dev`'s CORS rules, which only allow
`http://localhost:8081`. Phones don't need CORS.

## Checks

```bash
npm run check    # expo lint + tsc + vitest
npx expo-doctor  # dependency/config health for SDK 57
```

Add or upgrade Expo packages with `npx expo install <pkg>` (not `npm install`)
so versions match the SDK. `AGENTS.md` has Expo's own guidance for AI tools.

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

**Photos** are cropped square and resized to 800 px JPEG on the device, then
uploaded straight to S3 with the presigned POST from the API.

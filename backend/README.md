# backend

TypeScript Lambda behind the Pawpers HTTP API. One function (`src/api`)
serves every route; `src/api/routes.json` is the list of routes, read by both
the handler and Terraform (`infra/modules/api`) so they can't drift.

```bash
npm ci
npm run check   # lint + typecheck + tests
npm run build   # bundles to dist/api/index.mjs (Terraform zips this)
```

Needs Node 24, the same version as the Lambda runtime.

## Auth

Every route requires `Authorization: Bearer <token>`, where the token is a
Cognito ID or access token for the app client. API Gateway validates it
before the Lambda runs. The user's `sub` scopes every read and write, so no
route can reach another user's data.

## Routes

Request and response bodies are JSON. Dates are `YYYY-MM-DD`; timestamps are
ISO 8601. Optional fields read back as `null`. Send `null` or `""` to clear
one in a PATCH.

| Route | Body | Returns |
|---|---|---|
| `GET /pets` | | `200 { pets: Pet[] }` |
| `POST /pets` | `{ name, species, breed?, dob?, chip? }` | `201 Pet` |
| `GET /pets/{petId}` | | `200 Pet` |
| `PATCH /pets/{petId}` | any pet fields | `200 Pet` |
| `DELETE /pets/{petId}` | | `204` (also deletes its vaccinations and photos) |
| `POST /pets/{petId}/vaccinations` | `{ type, given, vet?, expires? }` | `201 Vaccination` |
| `PATCH /pets/{petId}/vaccinations/{vaccinationId}` | any vaccination fields | `200 Vaccination` |
| `DELETE /pets/{petId}/vaccinations/{vaccinationId}` | | `204` |
| `POST /pets/{petId}/photo/upload` | | `201 { url, fields, key, maxBytes, expiresAt }` |
| `PUT /pets/{petId}/photo` | `{ key }` | `200 Pet` |
| `DELETE /pets/{petId}/photo` | | `204` |

- `species`: `Dog` \| `Cat` \| `Rabbit` \| `Other`
- `chip`: exactly 15 digits
- `expires` must be on or after `given`

```ts
Pet = { id, name, species, breed, dob, chip, photoUrl, photoUpdatedAt,
        createdAt, updatedAt, vaccinations: Vaccination[] }  // vaccinations newest first
Vaccination = { id, petId, type, vet, given, expires, createdAt, updatedAt }
```

Errors: `{ message, details? }`. A `400` from validation includes
`details: [{ path, message }]`. `404` means the item doesn't exist or isn't
yours.

## Photos

1. `POST /pets/{petId}/photo/upload` returns a presigned S3 POST, valid for
   5 minutes.
2. Upload the JPEG straight to S3 as `multipart/form-data`: every entry in
   `fields` first, then the file as `file`. S3 rejects anything that isn't
   `image/jpeg` or is over `maxBytes` (5 MB).
3. `PUT /pets/{petId}/photo` with `{ key }`. This attaches the photo, sets
   `photoUpdatedAt`, and deletes the previous photo.

`photoUrl` on a pet is a presigned GET URL valid for 1 hour. The app should
download the image and cache it on the device for offline use; don't store
the URL itself.

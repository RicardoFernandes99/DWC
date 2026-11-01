# 011: Upload and serve private product images

- Macro: M03
- Status: In review
- Depends on: 010
- PR: Pending creation
- Branch / parent: `codex/age-011-product-images-api` / `codex/age-010-products-profile-api` at `012e82026c247d98f64904f2a630cfd234e7aa0f`
- Blockers: None beyond dependencies

## Outcome

Eligible producers attach real images to their products using the existing S3
service, without exposing storage credentials or making the bucket public.

## Read first

[Architecture](../architecture.md#local-services), [API image rules](../../apps/api/AGENTS.md),
`apps/api/src/storage/storage.service.ts` and product ownership from 010.

## Scope and contract

- Add an owner-authorized multipart upload for a product and document it in OpenAPI.
  Validate actual image bytes, allowed raster formats, size and pixel limits;
  choose/document concrete implementation limits. Reject unsupported SVG content.
- Use server-generated object keys and bounded uploads. Store object metadata on
  the product, not credentials. Keep the bucket private and use short-lived signed
  image access for eligible public products and owner previews.
- Replace an image without leaving a broken product reference when upload/DB writes
  fail. Report cleanup failures for later repair; Mongo rollback cannot undo S3.
- Signed URLs are response values, not durable database image identifiers. Preserve
  compatibility with Floci and another S3 provider via existing configuration.
- No image editor, general asset manager or external hosting service.

## Acceptance criteria

- [x] Owner uploads a valid image and sees a working authorized preview.
- [x] Another producer, pending account and oversized/spoofed file are refused.
- [x] Failed replacement preserves the previous working image/reference.
- [x] Responses/logs reveal no keys/secrets beyond intended object access.
- [x] Product archival/moderation cannot mint fresh public image URLs improperly.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Upload/replace a small raster image and try an invalid file or foreign product. Confirm the previous image survives a refused replacement.

## Delivery notes

- Implemented on `codex/age-011-product-images-api`, stacked on PR #20 (`codex/age-010-products-profile-api` at `012e82026c247d98f64904f2a630cfd234e7aa0f`) in stack #18.
- Concrete product image validation limits (`apps/api/src/products/product-image.validator.ts`):
  - Allowed raster formats verified by actual magic bytes and header dimensions: `image/jpeg` (`.jpg`), `image/png` (`.png`), and `image/webp` (`.webp`, supporting `VP8 `, `VP8L`, and `VP8X` chunks).
  - Maximum file size: `5_242_880` bytes (`5 MB`), enforced at both the Multer interceptor boundary and the byte validator.
  - Pixel bounds: width and height between `1` and `4096` pixels, maximum `16_777_216` total pixels (`4096 x 4096`).
  - SVG content (`image/svg+xml` or `<svg`/`<?xml` payloads) and spoofed MIME declarations are rejected with `400 Bad Request` before any S3 or MongoDB writes.
- Provider-neutral private S3 storage (`apps/api/src/storage/storage.service.ts`, `apps/api/src/storage/storage.module.ts`):
  - Server-generated private object keys (`products/<producerId>/<productId>/<uuid>.<ext>`).
  - Short-lived path-style `AWS4-HMAC-SHA256` query-string presigned `GET` URLs (`300s` default, bounded `60..900s`) minted at response time and never stored in MongoDB or logged; `S3_SECRET_ACCESS_KEY` is never exposed.
  - Safe image replacement: uploads new S3 object first, then performs a revision-guarded conditional MongoDB update (`_id`, `producerId`, `archivedAt: null`, `moderatedAt: null`, `revision`). Failed/conflicting database updates clean up the newly uploaded orphan S3 object and preserve the previous working `image` reference in MongoDB; successful replacements best-effort delete the old S3 object and log only `objectKey` if deferred cleanup is needed.
  - Archived (`archivedAt !== null`) and moderated (`moderatedAt !== null`) products preserve `hasImage: true` and `imageMeta` for historical reference while returning `imageUrl: null`, refusing `GET /api/producer/products/:id/image` and `POST /api/producer/products/:id/image` with `409 Conflict`, and returning `null` from `ProductsService.resolvePublicImageUrl`.
- Orchestrator/reviewer: Gemini 4 Argon (Low). Builder subagent: `self` (`Model: 'inherit'` — Gemini 4 Argon Low, `83734a84-d718-48e3-8288-13b1c2ddf1ed`, transcript usage: 152,418 input tokens, 2,213,551 cached tokens, 31,908 output/thinking tokens), with zero subagent correction rounds.
- Frontier verdict: APPROVED against parent `012e82026c247d98f64904f2a630cfd234e7aa0f`.
- Static and contract checks passed with Node 24.22.2 and pnpm 11.25.0:
  - `pnpm contract:generate` and `pnpm contract:check`
  - `pnpm typecheck` (`tsconfig.tools.json`, `@dwc/api`, `@dwc/web`)
  - `pnpm lint` (`eslint . --max-warnings 0`)
  - `pnpm test` (`@dwc/web`: 15/15 tests; `@dwc/api`: 8/8 tests including `product-images.test.ts`)
  - `pnpm build` (`@dwc/api` NestJS build and `@dwc/web` Vite + React Compiler build)
  - Scoped `prettier --check` on all touched/created files
- Real HTTP, MongoDB replica-set, Redis, and Floci S3 verification on isolated port `3021`:
  - Approved owner `POST /api/producer/products/:id/image` with valid 64x48 PNG (`200 OK`, `revision: 2`, `hasImage: true`, `imageMeta` 64x48 `image/png`, `imageUrl` signed URL), direct HTTP `GET` of the signed URL from Floci S3 (`200 OK`, `Content-Type: image/png`, exact byte match), and `GET /api/producer/products/:id/image` (`200 OK`, `expiresInSeconds: 300`, no secret key leaked).
  - Image replacement `POST /api/producer/products/:id/image` with valid 80x60 JPEG (`200 OK`, `revision: 3`, `image/jpeg`), confirming the replaced PNG object was deleted from Floci S3 (`HeadObjectCommand` rejected).
  - Refused replacements preserved the working 80x60 JPEG image in MongoDB and S3: SVG upload (`400 Bad Request`), HTML/script spoofed as `image/png` (`400 Bad Request`), oversized `> 5 MB` upload (`413 Payload Too Large`), stale revision (`409 Conflict`), foreign approved producer upload & preview (`404 Not Found`), and pending producer, rejected producer, suspended producer, and buyer upload & preview attempts (`403 Forbidden`). Following all refusals, `GET /api/producer/products/:id/image` still returned a working signed URL serving the exact 80x60 JPEG bytes from Floci S3.
  - Moderated (`moderatedAt !== null`) and archived (`POST /api/producer/products/:id/archive`) products returned `imageUrl: null` while preserving `hasImage: true` and `imageMeta`, refused `GET /api/producer/products/:id/image` with `409 Conflict`, and returned `null` from `ProductsService.resolvePublicImageUrl`.
  - All temporary verification users, products, Redis session keys, and S3 objects were cleaned up (`0` residual records).
- Limitations: Producer product/profile web management screens belong to Ticket 012; public catalogue endpoints consuming `resolvePublicImageUrl` belong to Ticket 013.

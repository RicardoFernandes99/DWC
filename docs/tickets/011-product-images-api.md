# 011: Upload and serve private product images

- Macro: M03
- Status: Draft
- Depends on: 010
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Owner uploads a valid image and sees a working authorized preview.
- [ ] Another producer, pending account and oversized/spoofed file are refused.
- [ ] Failed replacement preserves the previous working image/reference.
- [ ] Responses/logs reveal no keys/secrets beyond intended object access.
- [ ] Product archival/moderation cannot mint fresh public image URLs improperly.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Upload/replace a small raster image and try an invalid file or foreign product. Confirm the previous image survives a refused replacement.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

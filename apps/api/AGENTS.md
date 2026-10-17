# API instructions

- Read the root `AGENTS.md`; package name: `@dwc/api`.
- NestJS with strict TypeScript, Mongoose, Swagger, and AWS SDK S3 integration.
- Use Nest modules/controllers/services. Controllers handle transport, DTOs
  validate external input, services enforce domain rules and ownership.
- Preserve TypeScript decorator metadata; the standard Nest build/watch path
  emits it. Do not substitute a transpiler without checking injection behavior.
- API endpoints use `/api`; Swagger uses `/api-docs` and `/api-docs-json`.
- Document new endpoints, request/response schemas, authentication, and errors.
- Environment configuration is validated at startup. Never return connection
  strings or credentials from health checks or error responses.
- Use integer minor currency units for money in new domain models.
- MongoDB is a replica set. Bid acceptance must be a conditional atomic write
  against current state, increment, and server deadline. Client checks alone
  are insufficient. Persist/broadcast only accepted bids; discuss transactions
  if auction state and bid history must commit together.
- Use provider-neutral S3 operations with configurable endpoint and path style.
  Buckets remain private. Design authorized access before exposing image URLs.
- Do not implement fake authentication or trust role/user IDs from request data.
- Tests: `pnpm --filter @dwc/api test`; typecheck/build use the same filter.
- `pnpm smoke` exercises real services and removes only its own temporary data.

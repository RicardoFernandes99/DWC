# API instructions

Read root `AGENTS.md`, scope and architecture. Package: `@dwc/api`.
NestJS + strict TypeScript, Mongoose/MongoDB, class-validator/class-transformer,
Swagger/OpenAPI, and AWS SDK S3. JWT and Socket.io business features are planned;
do not describe them as implemented.

## Feature modules and responsibilities

- Organize by feature, such as `products/`, `orders/`, `auctions/`, rather than
  global folders of controllers/services. Create folders when features are built.
- Controllers own transport, validated DTOs and HTTP outcomes. Services enforce
  domain rules/ownership and coordinate work. Extract feature repositories for
  substantial queries, atomic writes and shared session handling; avoid generic
  repositories and pass-through layers with no useful responsibility.
- Use constructor injection. A module provides its own classes, exports only what
  consumers need, and imports another module rather than re-providing its services.
  Revisit responsibilities before introducing circular dependencies.
- Keep socket gateways thin too: authorize messages/room access and invoke domain
  services. An authenticated connection does not authorize every message.
- Preserve decorator metadata and Nest's standard build/watch path. Verify DI
  behavior before replacing the transpiler.
- Read `nestjs-best-practices` for architecture, persistence and security details.

## Contracts and input/output boundaries

- API prefix: `/api`. Swagger: `/api-docs` and `/api-docs-json` on the API.
  Define DTOs and document requests, success/errors, auth and pagination when
  adding endpoints. Keep frontend calls aligned with those schemas.
- Validate body, query and path values. The existing global pipe transforms input
  and rejects non-whitelisted properties. Bound IDs, enums, lengths, numbers and
  page sizes. Construct Mongo filters explicitly, never from arbitrary request JSON.
- Use deliberate statuses and consistent public errors. Invalid bids, insufficient
  stock and stale edits are expected domain refusals, not opaque 500s. Internal
  causes belong in logs; connection strings and credentials never belong in responses.
- Explicit projections/response DTOs control exposure. Input validation does not
  strip secret fields from returned documents. Never return password hashes.

## Persistence and concurrency

- Choose embedding/references from queries and consistency needs. Keep arrays
  bounded; snapshot order item names/prices when implementing orders.
- Money uses integer minor units. Validate quantities and use server-owned dates.
  Index real filter/sort patterns and enforce uniqueness in the database;
  read-before-create alone does not prevent duplicate inserts.
- MongoDB is a replica set. Stock availability, allowed prior state, and current
  auction price/increment/status/server deadline must hold in the acceptance write.
  An earlier read-check-save sequence is insufficient under concurrency.
- Use a shared transaction/session when auction state and bid history must commit
  together. Every participating operation uses that session. Keep transaction
  operations sequential; do not run them in `Promise.all`.
- Callbacks may retry: keep broadcasts, emails and S3 calls outside them. A database
  rollback cannot undo an external side effect. Publish only after commit.
- When stale human edits matter, use a revision in the atomic update predicate;
  do not assume every write has a unique timestamp.
- Test simultaneous bids/stock updates against real MongoDB, including deadline
  rejection. Document persistence-to-delivery gaps; add durable delivery only when
  required rather than introducing a queue by default.

## Security, images and operations

- Implement real JWT signature/expiry checks, password hashing and server-side role
  plus ownership enforcement when auth is built. Never trust request user IDs or
  roles. Do not add fake auth to make a page or demo appear functional.
- Apply bounded request bodies and targeted throttling where needed (especially
  sign-in and bids). Do not log passwords, tokens, auth headers or signed URLs.
- Separate generic S3 operations from feature image authorization/validation.
  Endpoint/path style stay configurable, buckets private, keys server-generated,
  and signed access short-lived. Validate actual bytes, size and pixel limits;
  MIME declarations alone are insufficient. Reject SVG unless sanitization exists.
- Validate configuration at startup. Liveness reports process health; readiness
  checks dependencies. Preserve graceful shutdown hooks. Start with Nest logging
  and useful operation/request IDs rather than an observability platform.

## Checks

Run API `test`, `typecheck` and `build` via `pnpm --filter @dwc/api`, plus root lint
and formatting checks. `pnpm smoke` needs a running API/services and removes only
its own temporary data. Mocks cannot prove database concurrency guarantees.

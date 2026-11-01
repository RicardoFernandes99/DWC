# 002: Connect the API to Redis and report readiness

- Macro: M01
- Status: Draft
- Depends on: Redis Compose/configuration changes from the current foundation
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Redis infrastructure must be present on the ticket base

## Outcome

The API owns a managed Redis connection for authentication sessions, reports its
availability and closes it cleanly. No authentication behavior is implemented yet.

## Read first

- [Local architecture](../architecture.md#local-services).
- [API guidance](../../apps/api/AGENTS.md) and `local-development`.
- `compose.yaml`, `.env.example`, `scripts/setup-local.ts`,
  `apps/api/src/config.ts`, `apps/api/src/app.module.ts`,
  `apps/api/src/health/health.service.ts`, `apps/api/scripts/smoke.ts`.

## Scope and contract

- Add a compatible official `redis` Node client to `@dwc/api` and commit the
  lockfile. Add a small Nest module/provider with bounded connection/command
  timeouts, handled connection errors and graceful shutdown. Avoid a generic cache
  layer, queue or second Redis client library.
- Require/validate server-only `REDIS_URL` at startup, accepting `redis:` or
  `rediss:` URLs and never printing connection values. Update the example comment
  from reserved to consumed. Preserve existing `.env` files; explain adding the
  new variable manually in setup docs.
- API liveness remains process-only. Readiness includes `checks.redis` alongside
  the existing MongoDB/storage entries and returns sanitized 503 when Redis is
  unavailable, rather than hanging or exposing the endpoint/credentials.
- Extend the existing smoke command with a random namespaced Redis write/read
  using a short TTL and cleanup. Never `FLUSHDB`, reset databases or delete volumes.
- Provide the connection/operations needed by ticket 003, without prematurely
  designing session records. Update README/architecture readiness claims.

## Acceptance criteria

- [ ] Missing/malformed Redis configuration fails with a useful sanitized error.
- [ ] Healthy Redis appears in readiness; disconnected Redis yields bounded 503.
- [ ] The process handles connection errors without an unhandled rejection.
- [ ] Smoke verifies value round-trip and expiry against real Redis and cleans its key.
- [ ] Closing the Nest app closes the client and does not leave a hanging process.
- [ ] MongoDB/storage readiness checks still work and existing local data is preserved.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Check Redis connectivity and sanitized readiness once, including a missing/unreachable configuration. Existing smoke is optional for troubleshooting; do not create a new suite.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

# 002: Connect the API to Redis and report readiness

- Macro: M01
- Status: In progress
- Depends on: Redis Compose/configuration changes from the current foundation
- PR: Not opened
- Branch / parent: `codex/age-002-redis-integration` / `codex/age-001-registration-api` (PR #5)
- Blockers: None. Redis infrastructure is present on the verified parent.

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

- [x] Missing/malformed Redis configuration fails with a useful sanitized error.
- [x] Healthy Redis appears in readiness; disconnected Redis yields bounded 503.
- [x] The process handles connection errors without an unhandled rejection.
- [x] Smoke verifies value round-trip and expiry against real Redis and cleans its key.
- [x] Closing the Nest app closes the client and does not leave a hanging process.
- [x] MongoDB/storage readiness checks still work and existing local data is preserved.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Check Redis connectivity and sanitized readiness once, including a missing/unreachable configuration. Existing smoke is optional for troubleshooting; do not create a new suite.

## Delivery notes

- Builder: `gpt-6-luna`, high reasoning, for bounded connection failure cases.
  No model changes. Implementation feedback corrected command/handshake deadlines
  and shutdown before handoff; zero post-handoff correction rounds.
  Token/credit usage unavailable.
- Frontier verdict: APPROVED. Reviewed the ticket-only diff and new Redis files
  against parent `a3faf2edd4810d7a7ef89bdbc2bee71e388ea373`.
- Static checks passed on Node 24.22.1 and pnpm 11.25.0: API `typecheck`, `build`,
  tools TypeScript check, root `lint`, scoped Prettier and `git diff --check`.
  Existing API tests passed, 4/4.
- Real-service evidence: healthy readiness and OpenAPI, MongoDB/S3 round-trip,
  and smoke Redis round-trip/expiry passed. An isolated API returned sanitized
  503 with unreachable Redis, recovered to 200 with Redis available, and returned
  to 503 when it stopped. Missing/malformed configuration failed startup without
  exposing values. Only verifier-owned records, objects, keys and temporary
  infrastructure were cleaned; shared services and volumes were preserved.
- Independent TCP-proxy checks passed: a silent Redis handshake closed its
  socket on shutdown; dropped replies hit the 1.5-second operation deadline;
  the replacement connection recovered; shutdown during a stalled real command
  completed within 2.2 seconds with no open proxy sockets or unhandled rejections.
  The initial builder listener-close uncertainty was resolved by this check.
- RedisModule exports typed bounded operations and `execute` for future atomic
  commands. Callbacks must return their operation promise and must not retain the
  client. A timeout cannot establish whether a sent write reached Redis; callers
  must resolve uncertain write outcomes using domain-specific atomic operations.
  Authentication sessions remain ticket 003.

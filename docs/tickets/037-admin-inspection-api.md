# 037: Inspect users, orders, auctions and service health as admin

- Macro: M08
- Status: In review
- Depends on: 002, 009, 019, 028
- PR: https://github.com/RicardoFernandes99/DWC/pull/51
- Branch / parent: `codex/age-037-admin-inspection-api` / `codex/age-036-content-moderation-api` (PR 50)
- Blockers: None beyond dependencies

## Outcome

Admins diagnose marketplace activity through read-only APIs without impersonating
users or directly rewriting domain state.

## Read first

[Administration](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), health/order/auction response contracts.

## Scope and contract

- Add bounded paginated admin lists/details for users, orders and auctions, with
  typed role/state/producer filters and stable sorting. Return safe admin DTOs.
- Include ownership/status/history, order/refund totals and auction settlement
  links useful for diagnosis. Never return password hashes, tokens, raw card data
  or Redis/DB/S3 credentials. Inspection does not create a mutation shortcut.
- Admin service-health response summarizes API/MongoDB/Redis/storage readiness
  and sanitized failures. Bound dependency check latency; no raw logs/config dump.
- Use existing domain read services/queries and indexes as appropriate. Do not
  add platform analytics, exports or arbitrary Mongo query endpoints.
- Existing public readiness remains deliberately limited and compatible with smoke.

## Acceptance criteria

- [x] Admin sees accurate bounded records and can follow real order/auction links.
- [x] Filters/invalid IDs/pages have explicit documented behavior.
- [x] Non-admin users are refused; DTOs contain no secret fields.
- [x] Dependency failure yields sanitized degraded health without hanging.
- [x] Inspection has no writes or accidental privilege/role mutation endpoints.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

The focused real-auth fixture is `demos/ticket-037-review/fixture.ts`. It creates
temporary bcrypt-backed accounts, exercises every admin route, validates record
links/refunds and safe fields, checks a degraded timeout probe without stopping
shared services, compares fixture-owned state before and after requests, and
cleans only those fixture records.

## Delivery notes

Implemented on `codex/age-037-admin-inspection-api`, based on PR 50's verified
parent commit `242a9dee39c5808b567b95aeac7f272a6c5e259e`.

- Builder: `gpt-6-luna` at high effort. Frontier verdict: APPROVED, with zero
  formal correction rounds. Review feedback during implementation corrected
  response metadata, explicit field mappings and DTO declaration ordering.
  Token and cost measurements are unavailable.
- Reviewed implementation: `577e975`. PR 51 is ready for review in native stack
  34. No merge performed.

- `pnpm --filter @dwc/api typecheck`: passed.
- `pnpm --filter @dwc/api build`: passed through contract generation/check.
- `pnpm --filter @dwc/web typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm contract:generate` and `pnpm contract:check`: passed. OpenAPI query
  schemas expose numeric page/limit bounds and the Web schema is current.
- Scoped Prettier check for changed API, contract, fixture and documentation:
  passed.
- Local API readiness on port 3131 returned 200 with MongoDB, Redis and storage
  up. The review fixture passed with real login sessions; all seven routes
  refused unauthenticated and buyer requests, filters and invalid input returned
  the documented errors, order refunds matched the per-order allocation,
  auction bid history was capped, and settlement order/payment IDs matched.
- Exact fixture command: `node --env-file=.env demos/ticket-037-review/fixture.ts`
  while the built API ran on port 3131. The API was started with
  `API_PORT=3131 pnpm --filter @dwc/api start`. Startup logs showed all seven
  routes mapped. The temporary API process was stopped after the fixture.
- The degraded health probe returned sanitized `down` states within 2.5 seconds.
  The HTTP health route is guarded by Redis-backed authentication, so it can
  return 503 during a Redis outage before the health service runs. The probe
  exercised the same bounded health collector in-process.

- Limitations: no Laravel or React admin UI. Degraded dependency behavior was
  checked through the shared collector, not by interrupting Docker services.
  Existing moderation controllers remain absent from the inherited Web contract
  exporter; this ticket adds only the inspection controllers.

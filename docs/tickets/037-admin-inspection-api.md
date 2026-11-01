# 037: Inspect users, orders, auctions and service health as admin

- Macro: M08
- Status: Draft
- Depends on: 002, 009, 019, 028
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Admin sees accurate bounded records and can follow real order/auction links.
- [ ] Filters/invalid IDs/pages have explicit documented behavior.
- [ ] Non-admin users are refused; DTOs contain no secret fields.
- [ ] Dependency failure yields sanitized degraded health without hanging.
- [ ] Inspection has no writes or accidental privilege/role mutation endpoints.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Inspect paginated records as admin/non-admin and check one sanitized degraded health response. No new broad smoke or inspection suite is required.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

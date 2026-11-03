# 026: Schedule auction lots and reserve catalogue stock

- Macro: M05
- Status: In progress
- Depends on: 010, 019
- PR: Not opened
- Branch / parent: `codex/age-026-auction-scheduling` / `codex/age-025-notifications-web` (PR #39, `22f2cefbda543097acde819f98b0e860f507064b`)
- Blockers: None; scheduled-auction suspension and downtime behavior is recorded in [product decisions](../product-decisions.md#laravel-administration-and-suspension).

## Outcome

Eligible producers schedule fixed lots from existing inventory and manage them
only before their start. Stock cannot also be sold in the catalogue.

## Read first

[Auction rules](../product-decisions.md#auctions),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
[API concurrency rules](../../apps/api/AGENTS.md), product/stock services.

## Scope and contract

- Introduce auction schema with owner/product, immutable lot snapshot/quantity,
  starting price/minimum increment in cents, server-validated start/end, state,
  current accepted bid summary and revision. Keep unbounded history for 027's bids.
- Producer-owned create/list/detail/edit/cancel routes; public paginated list/detail
  with safe DTOs supports upcoming/active/finished records, no invented bid history.
- Creation reserves available quantity transactionally with current eligibility.
  Pre-start edits adjust reservation deltas safely; pre-start cancellation releases
  stock exactly once. Never permit active edits/cancellation, even without bids.
- Scheduled auctions start using server time only while producer is eligible.
  A suspended producer's missed start cancels the auction and releases its lot
  exactly once. Recovery after API downtime retains original start/end times;
  reinstatement after the scheduled start does not revive a missed auction.
  Active auctions remain valid when a producer is suspended. Ended auctions
  remain persisted as active until ticket 028 settlement, while public reads
  report them as finished and bids can reject against the original deadline.
- Stock release must preserve archived/moderated visibility; restoring quantity
  must not republish a hidden product. Settlement/no-bid closure belongs to 028.

## Acceptance criteria

- [x] Create/edit/cancel maintains the exact available-plus-reserved quantity.
- [x] Concurrent checkout/reservation cannot oversell the same product.
- [x] Owner/status/start-time predicates prevent unauthorized or late edits.
- [x] Duplicate cancellation does not release twice; hidden stock stays hidden.
- [x] Public DTOs and scheduled suspension behavior match the resolved rules.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create/edit/cancel a lot and inspect stock. Try a late edit and one competing stock request; targeted automated race checks are optional.

## Delivery notes

- Frontier verdict: APPROVED, zero formal correction rounds. Executor: `gpt-6-luna`
  at High effort for transactional stock and scheduling concurrency. Usage and
  cost measurements are unavailable.
- Passed on Node 24.19.0 / pnpm 11.25.0: `pnpm contract:generate`,
  `pnpm contract:check` (including API build), API/Web typechecks, Web production
  build with React Compiler verification, root lint, scoped Prettier and
  `git diff --check`. Existing bundle-size warning remains.
- Real HTTP/MongoDB verification passed via the local
  `demos/ticket-026-review/verify-auctions.ts` script against API port 3026:
  create/edit/cancel stock deltas, duplicate cancellation, hidden/moderated stock
  release, competing actual checkout/reservation, null/past/stale/late refusals,
  immutable snapshot, overdue recovery with original deadlines, public finished
  view, active-auction suspension, suspended missed-start cancellation and
  post-start reinstatement cancellation. Only fixture-owned records and sessions
  were cleaned; the temporary API was stopped.
- Ended auctions remain persisted Active with reservations until ticket 028
  settlement. Ticket 035 must update `producerDecisionAt` on suspension decisions.
  The one-second runner processes at most 100 due records per pass; a delayed
  transition never shifts the stored deadline. No bidding or settlement is added.
- Unrelated order UI edits, guidance/docs changes and all pre-existing demos were
  excluded. Evidence scripts remain local under demos. No full test suite run.

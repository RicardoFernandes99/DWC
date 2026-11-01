# 026: Schedule auction lots and reserve catalogue stock

- Macro: M05
- Status: Blocked
- Depends on: 010, 019
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Decide scheduled-auction handling when suspension spans its start/end time

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
  Resolve the named suspension blocker before specifying paused/elapsed behavior.
  Active auctions remain valid when a producer is suspended.
- Stock release must preserve archived/moderated visibility; restoring quantity
  must not republish a hidden product. Settlement/no-bid closure belongs to 028.

## Acceptance criteria

- [ ] Create/edit/cancel maintains the exact available-plus-reserved quantity.
- [ ] Concurrent checkout/reservation cannot oversell the same product.
- [ ] Owner/status/start-time predicates prevent unauthorized or late edits.
- [ ] Duplicate cancellation does not release twice; hidden stock stays hidden.
- [ ] Public DTOs and scheduled suspension behavior match the resolved rules.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

After resolving suspension timing, create/edit/cancel a lot and inspect stock. Try a late edit and one competing stock request; targeted automated race checks are optional.

## Delivery notes

Not implemented. Resolve the named blocker; Sol reviews stock/time race evidence.

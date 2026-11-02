# 019: List orders and enforce sequential fulfilment

- Macro: M04
- Status: In progress
- Depends on: 017
- PR: Not opened
- Branch / parent: codex/age-019-order-tracking-api / codex/age-018-checkout-web (PR #29)
- Blockers: None beyond dependencies

## Outcome

Buyers track their orders and producers advance their own delivery/collection
orders one step at a time.

## Read first

[Order rules](../product-decisions.md#order-tracking-and-refunds),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), order/payment schema from 017.

## Scope and contract

- Add paginated buyer and producer order lists/details with safe snapshots,
  totals, fulfilment, payment/refund summary, origin and status history.
- Producer-owned status action atomically requires current revision/previous state.
  Delivery: pending -> confirmed -> shipped -> delivered. Collection: pending ->
  confirmed -> ready_for_collection -> collected. Record actor/time for each step.
- Refuse skipping, backwards or cross-fulfilment states with explicit conflicts.
  Handle same-request retries deliberately without appending duplicate history.
- Suspended producers can fulfil existing orders. Do not reject all their requests
  with a global suspension guard. Buyers cannot advance fulfilment.
- Reserve a confirmation predicate for an open refund request so 020 can block it.
  No notifications until 023, and no refund/cancel write endpoints here.
- Future auction orders can enter at confirmed with collection fulfilment through
  a domain service, not by exposing arbitrary initial-status input to buyers.

## Acceptance criteria

- [ ] Buyer/producer lists expose only owned orders with bounded pagination.
- [ ] Both flows permit only the next step; cross-role and foreign-ID writes fail.
- [ ] Concurrent status requests cannot skip a stage or duplicate history.
- [ ] Suspended producers still fulfil existing orders; current status is returned.
- [ ] Product/profile changes do not alter historical order snapshots or amounts.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Advance one delivery and one collection order, then try skipping a step or changing another producer order. A few direct requests are enough for the default check.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

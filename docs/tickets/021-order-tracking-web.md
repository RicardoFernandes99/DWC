# 021: Track orders and handle refund requests in buyer/producer UI

- Macro: M04
- Status: Draft
- Depends on: 008, 018, 019, 020
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Buyers see each order's progress and refund decision; producers fulfil orders and
handle Pending-only cancellation/refund requests.

## Read first

[Order/refund rules](../product-decisions.md#order-tracking-and-refunds),
[web guidance](../../apps/web/AGENTS.md), APIs 019/020 and account routing.

## Scope and contract

- Add buyer `/orders` and producer order routes with pagination, detail, line/fee
  snapshots and delivery/collection timelines using the actual current server state.
- Show one next-step action to the producer; buyer has no fulfilment status controls.
  Suspended producers retain order access and the suspension banner.
- On Pending orders buyers can request refunds. Producers can accept/decline an
  open request or cancel/refund directly. Require the decline reason; confirm
  consequential actions with actual paid/refund amounts, including delivery fees.
- Open requests visibly block confirmation. Handle stale-state 409 by refreshing,
  not pretending success or replaying a conflicting action indefinitely.
- Cancelled/refunded orders have explicit terminal presentation. Auction orders
  later reuse collection tracking with confirmed entry. Review entry arrives in 031.
- Live refresh attaches in 024; fetching after mutations/revisit works without it.

## Acceptance criteria

- [ ] Buyer/producer views reflect both fulfilment flows and correctly scoped actions.
- [ ] Refund request/accept/decline and direct cancellation use real API outcomes.
- [ ] Sibling orders remain visible and unchanged after a partial checkout refund.
- [ ] Suspended producer can fulfil; buyers cannot access producer order data.
- [ ] Keyboard actions, long order lists and all responsive ranges are usable.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Walk through both fulfilment timelines and a refund request/decision with two accounts. Check stale-state feedback, exact totals and responsive/keyboard controls.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

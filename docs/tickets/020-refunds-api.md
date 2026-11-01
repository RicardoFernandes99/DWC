# 020: Request refunds and cancel Pending orders safely

- Macro: M04
- Status: Draft
- Depends on: 019
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Buyers request a refund on Pending orders; producers accept/decline or directly
cancel/refund. Stock and simulated money are restored once.

## Read first

[Refund decisions](../product-decisions.md#order-tracking-and-refunds),
[fees](../product-decisions.md#collection-and-delivery-fees),
[API guidance](../../apps/api/AGENTS.md), order/payment/stock services.

## Scope and contract

- Buyer action creates one open request on an owned Pending order. Order remains
  pending; atomically block confirmation while the request is open.
- Producer accept cancels/refunds; decline requires a reason and permits normal
  progression. Direct producer "Cancel and refund" is also Pending-only.
- Define explicit refund-request state separate from order fulfilment state and
  add cancelled as a terminal order state. Expose reasons and outcomes only to
  entitled buyer/producer/admin views.
- Transactionally restore ordered quantities and refund the product amount plus
  that order's delivery fee. Never refund/reprice sibling orders or rerun today's
  free-delivery threshold. Use original payment/order snapshots.
- Protect refund, stock restoration and payment allocation with uniqueness and
  conditional state predicates. Duplicate requests/retries cannot refund twice.
- Auction orders start confirmed and cannot use these Pending-only actions.
  Persist outcomes now; notification integration is 023.

## Acceptance criteria

- [ ] Open request prevents confirmation; decline requires a reason.
- [ ] Acceptance/direct cancellation restores stock and the exact paid order total.
- [ ] Concurrent confirmation/refund has one valid outcome, never both.
- [ ] Repeated decisions cannot restore stock or refund twice; siblings are unchanged.
- [ ] Foreign orders, non-Pending states and auction orders are refused appropriately.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Request/decline/accept a refund and repeat the decision; verify product stock and paid delivery fee refund once. A small refund-versus-confirmation race check is optional.

## Delivery notes

Not implemented. Sol reviews payment allocation and concurrency evidence directly.

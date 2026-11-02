# 020: Request refunds and cancel Pending orders safely

- Macro: M04
- Status: In review
- Depends on: 019
- PR: https://github.com/RicardoFernandes99/DWC/pull/32
- Branch / parent: `codex/age-020-refunds-api` / `main`
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

- [x] Open request prevents confirmation; decline requires a reason.
- [x] Acceptance/direct cancellation restores stock and the exact paid order total.
- [x] Concurrent confirmation/refund has one valid outcome, never both.
- [x] Repeated decisions cannot restore stock or refund twice; siblings are unchanged.
- [x] Foreign orders, non-Pending states and auction orders are refused appropriately.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Request/decline/accept a refund and repeat the decision; verify product stock and paid delivery fee refund once. A small refund-versus-confirmation race check is optional.

## Delivery notes

- Builder: `gpt-6-luna`, medium effort. Two correction rounds; no model/effort
  adaptation. Input, cached input, output/reasoning usage, rates and total cost
  are unavailable, including orchestration and review.
- Parent: `main` at `3924477699908af6baf5f583c61a1735d5f64ec9`. No open feature
  stack existed. Frontier verdict: APPROVED after reviewing the ticket-only diff.
- Reviewed implementation/check revision: `5799f362e7f0a91c9d228af146fcd1593c2765b4`.
  The subsequent delivery update changes ticket metadata only.
- Passed with Node 24.19.0 and pnpm 11.25.0:
  - `pnpm --filter @dwc/api typecheck` and `pnpm --filter @dwc/api build`.
  - API test TypeScript compilation and 11 focused order-tracking tests.
  - `pnpm lint` and scoped Prettier checks.
  - `pnpm contract:generate` and `pnpm contract:check`.
  - `pnpm --filter @dwc/web typecheck` and `pnpm --filter @dwc/web build`.
- Real HTTP/MongoDB checks passed with isolated records, removed afterward:
  - Request, decline with a required nonblank reason, request again, accept,
    and repeat acceptance/direct cancellation. The EUR 29 refund included the
    original EUR 5 delivery fee; stock restored once and the sibling order was
    unchanged. An existing payment without `refundedCents` was supported.
  - Concurrent direct collection refunds restored EUR 24 and stock once.
  - Declining allowed normal confirmation. Foreign buyer/producer access returned
    404; confirmed and auction orders refused refund actions with 409.
  - Four confirmation/direct-refund races and four confirmation/refund-request
    races each had one successful action with consistent state. These sampled
    races do not prove every possible interleaving.
  - A failed payment rolled back cancellation, stock restoration and allocation
    together. Readiness reported MongoDB, Redis and S3 up.
- The final correction changed Mongoose type parameters and test setup only;
  unchanged runtime and contract evidence was retained.
- Limitations: Web build retains its non-blocking large-chunk warning. Refund UI
  and notification delivery remain later-ticket work.

# 021: Track orders and handle refund requests in buyer/producer UI

- Macro: M04
- Status: In review
- Depends on: 008, 018, 019, 020
- PR: https://github.com/RicardoFernandes99/DWC/pull/33
- Branch / parent: `codex/age-021-order-tracking-web` / `codex/age-020-refunds-api` (PR #32)
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

- [x] Buyer/producer views reflect both fulfilment flows and correctly scoped actions.
- [x] Refund request/accept/decline and direct cancellation use real API outcomes.
- [x] Sibling orders remain visible and unchanged after a partial checkout refund.
- [x] Suspended producer can fulfil; buyers cannot access producer order data.
- [x] Keyboard actions, long order lists and all responsive ranges are usable.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Walk through both fulfilment timelines and a refund request/decision with two accounts. Check stale-state feedback, exact totals and responsive/keyboard controls.

## Delivery notes

- Reviewed implementation/check revision: `42471d1`. The following commit updates
  ticket delivery metadata only. Native GitHub stack: #34, with PR #32 as parent.

- Builder: `gpt-6-luna`, high effort. One correction round, no model adaptation.
  Input, cached input, output/reasoning usage, rates and total cost are unavailable,
  including orchestration and review.
- Parent: PR #32, `codex/age-020-refunds-api` at
  `1de266b61070c9db6e063db8aa8d7abbdc37b344`. Its order/refund API and the earlier
  onboarding/checkout code were verified before implementation. Frontier verdict:
  APPROVED after the ticket-only diff and real browser checks.
- Added buyer and producer paginated lists/details, immutable item/fee totals,
  delivery/collection timelines, sequential producer actions, refund requests,
  required decline reasons and amount confirmations. Queries include account IDs;
  URL pagination survives detail navigation; malformed IDs are refused locally.
  Conflicts refresh current state without retrying mutations. Suspended producers
  retain fulfilment and refund access with the suspension banner.
- Passed with Node 24.19.0 and pnpm 11.25.0:
  - `pnpm --filter @dwc/web typecheck` and `pnpm --filter @dwc/web build`, including
    React Compiler verification.
  - `pnpm lint`, scoped Prettier checks and `git diff --check`.
- Real Edge/API/MongoDB browser checks passed with isolated records:
  - Both complete fulfilment timelines; buyers had no status controls.
  - Buyer request, producer decline with reason, repeat request and acceptance.
    Delivery refund was EUR 29, including the original EUR 5 fee. Direct collection
    cancellation displayed its EUR 24 refund as terminal.
  - Refunding one producer order preserved the sibling order's displayed state.
  - Suspended producer fulfilment; buyer refusal on producer routes; foreign
    buyer detail refusal; a genuine stale-revision 409 with refresh feedback.
  - Paginated lists and detail layouts at 375, 900 and 1440 pixels, no horizontal
    overflow, and keyboard access to the decline form. Screenshots were inspected.
- Browser evidence is local in `demos/ticket-021-review/`. Review accounts,
  products, orders, payments and their Redis sessions were removed afterward.
  The first browser attempt used an origin different from configured WEB_ORIGIN;
  the successful run used `http://localhost:5173`.
- Limitations: live notification refresh remains ticket 024. Build retains the
  existing non-blocking large-chunk warning. No API contract changed.

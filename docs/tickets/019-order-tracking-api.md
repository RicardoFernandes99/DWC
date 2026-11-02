# 019: List orders and enforce sequential fulfilment

- Macro: M04
- Status: In review
- Depends on: 017
- PR: https://github.com/RicardoFernandes99/DWC/pull/30
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

- [x] Buyer/producer lists expose only owned orders with bounded pagination.
- [x] Both flows permit only the next step; cross-role and foreign-ID writes fail.
- [x] Concurrent status requests cannot skip a stage or duplicate history.
- [x] Suspended producers still fulfil existing orders; current status is returned.
- [x] Product/profile changes do not alter historical order snapshots or amounts.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Advance one delivery and one collection order, then try skipping a step or changing another producer order. A few direct requests are enough for the default check.

## Delivery notes

- Executor model: Gemini 3.8 Flash (direct execution).
- Frontier review verdict: APPROVED.
- Pull Request: https://github.com/RicardoFernandes99/DWC/pull/30 stacked on PR #29 (`codex/age-018-checkout-web`).
- Implemented `GET /api/orders` and `GET /api/orders/:orderId` with strict role-scoping:
  - Buyers view only orders where `buyerId == user.id`.
  - Producers view only orders where `producerId == user.id`.
  - Foreign IDs or mismatched role queries return 404 / 403.
- Implemented `PATCH /api/orders/:orderId/status` for producers to advance order fulfilment:
  - Delivery flow: `pending` → `confirmed` → `shipped` → `delivered`.
  - Collection flow: `pending` → `confirmed` → `ready_for_collection` → `collected`.
  - Atomic conditional MongoDB update (`findOneAndUpdate` on `{ _id, producerId, status: currentStatus, ... }`) with optimistic revision tracking.
  - Step-skipping, backwards, and cross-fulfilment transitions rejected with 409 Conflict (`invalid_status_transition`).
  - Idempotent retries: repeated submissions for an order already in target status return current order without duplicate history entries.
  - Reserved `canConfirmOrder` confirmation predicate to block confirmation when a refund request is open (for ticket 020).
- Suspension policy:
  - Suspended producers (`ProducerStatus.Suspended`) retain ability to view and advance their existing orders (no global suspension block).
  - Buyers cannot advance fulfilment (403 Forbidden).
- Unit/integration tests in `apps/api/test/order-tracking.test.ts` pass 11/11 targeted scenarios (all 26 API tests pass).
- Exported web OpenAPI contract (`openapi.json` and `src/lib/api-schema.ts`).
- Verification passed: `pnpm --filter @dwc/api test`, `pnpm --filter @dwc/web test session cart.test`, `pnpm typecheck`, `pnpm lint`, `pnpm contract:check`, and `pnpm -r build`.

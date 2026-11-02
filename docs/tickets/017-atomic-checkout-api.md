# 017: Create paid producer orders atomically at checkout

- Macro: M04
- Status: In review
- Depends on: 005, 016
- PR: https://github.com/RicardoFernandes99/DWC/pull/28
- Branch / parent: codex/age-017-atomic-checkout-api / main
- Blockers: None beyond dependencies

## Outcome

A successful buyer checkout records one simulated payment and one Pending order
per producer. Any refusal leaves no orders, payment success or stock deductions.

## Read first

[Checkout](../product-decisions.md#checkout-stock-and-payment),
[fees](../product-decisions.md#collection-and-delivery-fees),
[API concurrency guidance](../../apps/api/AGENTS.md), 005 and 016 contracts.

## Scope and contract

- Introduce checkout/order/payment records with buyer/producer references,
  immutable line snapshots, fees, address/fulfilment, origin and timestamps.
- `POST /api/checkout` accepts canonical quote input/fingerprint, buyer-owned
  unexpired payment-method ID and an idempotency key. Return checkout ID and
  per-producer order IDs/totals. Support submitting a newly added method from 005.
- Recompute prices/fees and current producer eligibility. On changed quoted price
  return a reconfirmation conflict; stock/status refusals use structured line issues.
- Use real MongoDB transactions and conditional stock writes. Recheck producer
  eligibility with a concurrency strategy that orders suspension and checkout
  acceptance; an earlier status read alone is insufficient.
- Simulated payment success is an internal MongoDB record in the same transaction,
  never a real gateway call. Enforce uniqueness of checkout idempotency per buyer
  so retries return the original result without charging/reserving twice.
- Publish effects only after commit. No invoice implementation or fulfilment/
  refund transitions here; define the order contract consumed by 019/020/027.

## Acceptance criteria

- [x] Mixed-producer checkout creates correct Pending orders and one payment result.
- [x] One unavailable line rolls back every order, stock write and success record.
- [x] Simultaneous buyers cannot oversell; suspension races cannot accept ineligible sales.
- [x] Same-key retries do not duplicate work; changed payload with reused key conflicts.
- [x] Stored amounts/snapshots are server-owned and card data remains metadata only.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Submit a two-producer checkout, retry its idempotency key and try a stock refusal. Exercise a pair of competing stock requests; a small targeted regression test is optional.

## Delivery notes

- Executor model: Gemini 3.8 Flash (direct execution).
- Implemented `POST /api/checkout` with `RoleGuard` (Buyer role required).
- Implemented `Order`, `Payment`, and `Checkout` schemas with indexes, immutable line item snapshots, integer EUR cent amounts, and status history entries.
- Wrapped checkout operations in MongoDB replica set transaction (`withTransaction`) with conditional stock updates (`availableStock: { $gte: quantity }`) and active producer status locking (`producerStatus: ProducerStatus.Approved`).
- Recomputes quote fingerprint against live DB and returns `409 Conflict` (`price_changed`) if prices or revisions changed.
- Enforced idempotency per buyer with `{ buyerId: 1, idempotencyKey: 1 }` unique index; retries return cached result without duplicate charges/deductions; mismatched payload throws `409 Conflict` (`idempotency_mismatch`).
- Automated tests in `apps/api/test/atomic-checkout.test.ts` pass 5/5 targeted scenarios.
- All 20 tests pass across test suite; `pnpm check` and `pnpm smoke` verified.

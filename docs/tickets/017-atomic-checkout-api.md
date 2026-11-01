# 017: Create paid producer orders atomically at checkout

- Macro: M04
- Status: Draft
- Depends on: 005, 016
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Mixed-producer checkout creates correct Pending orders and one payment result.
- [ ] One unavailable line rolls back every order, stock write and success record.
- [ ] Simultaneous buyers cannot oversell; suspension races cannot accept ineligible sales.
- [ ] Same-key retries do not duplicate work; changed payload with reused key conflicts.
- [ ] Stored amounts/snapshots are server-owned and card data remains metadata only.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Submit a two-producer checkout, retry its idempotency key and try a stock refusal. Exercise a pair of competing stock requests; a small targeted regression test is optional.

## Delivery notes

Not implemented. Sol must review the transaction and concurrency evidence directly.

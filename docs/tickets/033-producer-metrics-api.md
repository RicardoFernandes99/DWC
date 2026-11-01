# 033: Calculate producer sales metrics and low-stock warnings

- Macro: M07
- Status: Blocked
- Depends on: 010, 020, 028
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Agree reporting periods, revenue recognition and best-seller ranking definition

## Outcome

Producers get their own sales totals, order counts, best-selling products and
low-stock warnings from authoritative order/product data.

## Read first

[Dashboard decisions](../product-decisions.md#producer-dashboard),
[API guidance](../../apps/api/AGENTS.md), order/refund/auction snapshots and products.

## Scope and contract

- Resolve whether sales count paid Pending orders or only completed fulfilment,
  which time periods/zone are used and whether best sellers rank by units or revenue.
  Product quantity units must not be added as if kilograms and items were equivalent.
- Owner-only metrics endpoint returns sales/order counts, best sellers and current
  low-stock items using documented date filters and stable bounded ranking.
- Include auction sales and exclude cancelled/refunded orders, using the original
  order line amounts. Keep product revenue distinct from delivery charges.
- Low-stock warnings compare current available catalogue stock with each product's
  configured threshold, with reserved auction stock treated consistently with 010/026.
- Keep aggregates scoped to current producer; no all-platform report or speculative
  analytics store. Document indexes and use Mongo aggregation where appropriate.

## Acceptance criteria

- [ ] Metrics match fixtures across store/auction and cancelled/refunded orders.
- [ ] Boundaries/time periods and definition of revenue/rank follow resolved rules.
- [ ] Producers cannot query another producer's metrics or see buyer/payment details.
- [ ] Threshold boundaries and reserved stock produce correct low-stock warnings.
- [ ] Empty datasets return honest zeros/empty lists, not fabricated trends.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

After defining the metrics, compare displayed API totals with a small known fixture including auction and refunded orders. Check low-stock threshold boundaries manually.

## Delivery notes

Not implemented. Resolve metric definitions before starting; record evidence here.

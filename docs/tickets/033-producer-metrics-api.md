# 033: Calculate producer sales metrics and low-stock warnings

- Macro: M07
- Status: In review
- Depends on: 010, 020, 028
- PR: [#47](https://github.com/RicardoFernandes99/DWC/pull/47)
- Branch / parent: `codex/age-033-producer-metrics-api` on PR #46 `codex/age-032-reviews-web` (`a103d40`)
- Blockers: None (metric definitions resolved 2026-11-04, see product decisions)

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

- [x] Metrics match fixtures across store/auction and cancelled/refunded orders.
- [x] Boundaries/time periods and definition of revenue/rank follow resolved rules.
- [x] Producers cannot query another producer's metrics or see buyer/payment details.
- [x] Threshold boundaries and reserved stock produce correct low-stock warnings.
- [x] Empty datasets return honest zeros/empty lists, not fabricated trends.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

After defining the metrics, compare displayed API totals with a small known fixture including auction and refunded orders. Check low-stock threshold boundaries manually.

## Delivery notes

- Decisions (user, 2026-11-04): sales are all non-cancelled orders from creation;
  rolling `7d|30d|90d|all` periods (default 30d) on order `createdAt`; best
  sellers top 5 by product revenue, ties by order count then product ID. Recorded
  in [product decisions](../product-decisions.md#producer-dashboard).
- `GET /api/producer/metrics?period=` in `apps/api/src/producer-metrics/`:
  approved or suspended producers only (403 otherwise), producer ID from the
  token, `Cache-Control: no-store`. Returns sales totals split by catalogue and
  auction, product revenue from original line totals with delivery fees separate,
  best sellers with `unitsSold` grouped per snapshot unit, and up to 50 low-stock
  products (non-archived, `availableStock <= lowStockThreshold`; reserved auction
  stock is already outside `availableStock`) plus a total count. Best-seller
  names come from the latest order snapshot.
- Indexes: none added. Orders use `{producerId, createdAt}` and low stock uses
  `{producerId, archivedAt, createdAt}`; the low-stock sort is per producer.
- Builder: Claude Sonnet (Agent tool), frontier review by Claude Opus 5.5.
  Verdict APPROVED after 0 correction rounds; no frontier code edits.
- Checks on the reviewed revision: `pnpm --filter @dwc/api typecheck` and
  `build`, root `pnpm lint`, `pnpm contract:generate` then `contract:check`,
  scoped Prettier and `git diff --check` all pass.
- Real stack: API built from this branch on port 3131 against local Mongo. The
  fixture script `demos/ticket-033-review/metrics-api.ts` (kept local) seeded
  store, auction, cancelled/refunded and other-producer orders across all
  periods and passed 9/9 groups: totals, fee separation, ranking tie-break,
  unit grouping, low-stock boundaries (equal/below/above, archived, reserved),
  privacy, 400/401/403 refusals, suspended access and empty-producer zeros.
- PR #47 is ready for review in native stack #34. The reviewed implementation commit is `c8b929f`.
- Limitations: no automated tests added; usage figures are unavailable.

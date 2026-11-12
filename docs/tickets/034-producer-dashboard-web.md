# 034: Show producer metrics, best sellers and low-stock warnings

- Macro: M07
- Status: In review
- Depends on: 012, 021, 033
- PR: [#48](https://github.com/RicardoFernandes99/DWC/pull/48) (ready for review, native stack #34)
- Branch / parent: `codex/age-034-producer-dashboard-web` on `codex/age-033-producer-metrics-api` (PR #47, `d73638e`)
- Blockers: None beyond dependencies

## Outcome

Approved producers understand sales/order performance and find products needing
stock attention without an oversized analytics dashboard.

## Read first

[Dashboard rules](../product-decisions.md#producer-dashboard),
[web guidance](../../apps/web/AGENTS.md), producer shell/product UI and API 033.

## Scope and contract

- Add sales totals, order counts, best-selling product list and low-stock section
  to `/producer`, with only the reporting controls supported by the API.
- Explain the chosen period/revenue definition in concise product copy. Display
  units accurately and distinguish product sales from delivery fees where shown.
- Link low-stock items to owner product editing and reuse the per-product threshold
  form from 012. Do not create a second stock source or infer totals from one page
  of orders downloaded into the browser.
- Keep existing pending/rejected application screens. Suspended producers retain
  permitted historical metrics/order navigation with the suspension banner.
- Include empty/loading/refresh-error states. Use charts only if they clarify real
  data supplied by the API; no decorative invented growth percentages.

## Acceptance criteria

- [x] Values match the server for the selected period and current producer.
- [x] Zero data, cancelled/refunded exclusions and auction sales display correctly.
- [x] Threshold edits refresh warnings; navigation reaches the right owned product.
- [x] Pending/suspended accounts retain the correct status/permissions presentation.
- [x] Numeric summaries and lists work by keyboard at all three screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Compare the dashboard with known data, edit a low-stock threshold and inspect empty/error states. Check labels, numbers and responsive/keyboard navigation.

## Delivery notes

- Implementation: `apps/web/src/features/producer-dashboard/` (typed metrics
  query/period helpers plus summary, best-sellers, low-stock and period-selector
  components). `Account` renders it on the exact `/producer` path for approved
  and suspended producers, between onboarding and products. `period` is a
  validated URL search param (default 30d omitted) on `/producer` and
  `/producer/$`, because TanStack matches `/producer` to the splat route.
  Product save/create/archive invalidates the metrics cache. Suspended
  producers see read-only low stock, because the products API rejects them.
  No API change and no charts.
- Executor: Claude Sonnet builder, orchestrated and reviewed by Claude Opus 5.5.
  Two correction rounds: (1) a router invariant crash from
  `useSearch({ from: '/producer' })`; (2) composition: heading hierarchy,
  status flicker, orphaned mobile tile, two columns from `md`, and low-stock
  Edit buttons matching the product cards. The orchestrator also made one small
  fix itself: `Account` reads the pathname with `useLocation` instead of
  `window.location`, so the dashboard hides after in-app navigation to the edit
  route.
- Frontier verdict: APPROVED on `1f2e1ce` (implementation); PR #48 opened ready for review on parent #47 at `d73638e`.
- Checks on the reviewed revision: web typecheck, web build ("React Compiler
  output verified"), root lint, scoped Prettier and `git diff --check` passed.
- Real-stack browser check: `demos/ticket-034-review/review-browser.ts`
  (untracked) passed all 10 groups against the API on 3131 and Vite on 5174,
  using a Mongo fixture from `seed.ts` that was removed afterwards. Covered:
  30d/90d/all/7d totals equal to the server (6/7/8/3 orders, EUR 103.00
  revenue, EUR 18.00 separate fees at 30d); cancelled order excluded; auction
  sale split; top-5 ranking with per-unit quantities; keyboard arrow period
  switching that updates the URL; a threshold edit through the low-stock link
  that refreshes warnings; refresh-error stale notice; initial-error Retry;
  loading; empty producer; suspended banner with metrics and no edit links;
  pending producer without the dashboard. No horizontal overflow at
  390/768/900/1440.
- Limits: the 7 known `pnpm --filter @dwc/web test` failures (`isServer` of
  null) are pre-existing and were not rerun. After saving a product, the editor
  returns to `/producer` without the previously selected period.

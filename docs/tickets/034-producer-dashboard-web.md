# 034: Show producer metrics, best sellers and low-stock warnings

- Macro: M07
- Status: Draft
- Depends on: 012, 021, 033
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Values match the server for the selected period and current producer.
- [ ] Zero data, cancelled/refunded exclusions and auction sales display correctly.
- [ ] Threshold edits refresh warnings; navigation reaches the right owned product.
- [ ] Pending/suspended accounts retain the correct status/permissions presentation.
- [ ] Numeric summaries and lists work by keyboard at all three screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Compare the dashboard with known data, edit a low-stock threshold and inspect empty/error states. Check labels, numbers and responsive/keyboard navigation.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

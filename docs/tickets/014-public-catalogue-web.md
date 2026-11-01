# 014: Build catalogue and public producer pages

- Macro: M03
- Status: Draft
- Depends on: 004, 013
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Visitors browse/filter products and inspect producer pages, including map location,
without signing in.

## Read first

[Discovery decisions](../product-decisions.md#public-browsing-catalogue-and-cart),
[web guidance](../../apps/web/AGENTS.md), existing app tokens and API 013.

## Scope and contract

- Replace the starter's main content with catalogue/product detail and producer
  routes. Put shareable filters, sorting and pagination in validated URL state.
  Debounce text search where useful and let Query own request state.
- Product grids use two columns below 768px, three at 768-1279px and four from
  1280px. Other controls/layouts adapt to space rather than those column counts.
- Support every agreed filter, clear filters, stable pagination, loading/empty/
  failure states and real image dimensions. Display unit and price consistently.
- Producer page displays public profile, collection location on a map and its
  products. Choose a compatible map solution at implementation, document any
  external requirements and preserve provider attribution. No radius calculation.
- Reviews and auctions are integrated in 031/029 when available. Do not imply
  those features or ratings exist yet. Cart actions arrive in 015.
- Hidden/unavailable direct URLs produce appropriate unavailable/not-found UI.

## Acceptance criteria

- [ ] Filter URL survives reload/back/forward and matches API queries.
- [ ] All ranges, long names, keyboard navigation and filter errors remain usable.
- [ ] Producer locations render correctly; missing coordinates are handled honestly.
- [ ] A suspended/hidden listing disappears and direct-link refusal is handled.
- [ ] Public browsing never requires a token or exposes private profile fields.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Browse/filter a producer catalogue, reload a filter URL and inspect empty/error states. Check the map and all three responsive ranges.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

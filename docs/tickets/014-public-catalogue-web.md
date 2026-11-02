# 014: Build catalogue and public producer pages

- Macro: M03
- Status: In review
- Depends on: 004, 013
- PR: https://github.com/RicardoFernandes99/DWC/pull/24
- Branch / parent: `codex/age-014-public-catalogue-web` / `origin/main` (`f07f37d887e86d930fde9dcdd8728bd3f2f092a9`)
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

- [x] Filter URL survives reload/back/forward and matches API queries.
- [x] All ranges, long names, keyboard navigation and filter errors remain usable.
- [x] Producer locations render correctly; missing coordinates are handled honestly.
- [x] A suspended/hidden listing disappears and direct-link refusal is handled.
- [x] Public browsing never requires a token or exposes private profile fields.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Browse/filter a producer catalogue, reload a filter URL and inspect empty/error states. Check the map and all three responsive ranges.

## Delivery notes

- Implemented on `codex/age-014-public-catalogue-web`, based on `origin/main` (`f07f37d887e86d930fde9dcdd8728bd3f2f092a9`).
- Builder: `gpt-6-luna` (medium) during the Codex session (`input_tokens`: 23,786,809, `cached_input_tokens`: 23,535,616, `output_tokens`: 86,738, `reasoning_output_tokens`: 37,982), with one frontier review correction round completed before the Codex session hit its usage limit (`input_tokens`: 14,686,663, `cached_input_tokens`: 14,506,368, `output_tokens`: 13,556, `reasoning_output_tokens`: 2,680). Resumed and completed final verification and PR publication in Antigravity (Gemini 4 Argon Low).
- Frontier verdict: APPROVED after verifying the correction round fixes (preserved spaces while typing multiword locations, controlled price draft reset on Clear filters, 120-character name wrapping on product/producer views, and missing-coordinate map fallback).
- The public producer map uses OpenStreetMap's export iframe; browsers need access to `openstreetmap.org`, and the page links to the required [OpenStreetMap attribution](https://www.openstreetmap.org/copyright). The embed needs no API key. Profiles remain readable when coordinates are absent, with a clear unavailable-map message.
- Browser checks and scoped local fixtures (`demos/ticket-014-review/`) verified: responsive product-grid columns (2/3/4) and no horizontal overflow at 375, 900 and 1440px across catalogue, product detail and producer pages; debounced search URL reload/back/forward and preserved keyboard focus; multiword location filter typing; valid and inverted price ranges, invalid decimal input alert and Clear filters draft reset; producer search/selection and shareable pagination; signed S3 product image rendering; 120-character product and farm names; OpenStreetMap embed and missing-coordinate fallback; unpublished and suspended direct-link 404 refusals; and retry recovery after an injected 503. All temporary MongoDB and S3 review fixtures were removed using only the IDs in `fixture.json`.
- Static checks passed with Node 24.22.2: `pnpm --filter @dwc/web typecheck`, `pnpm --filter @dwc/web build` (including React Compiler verification; existing ~543 kB main-chunk Vite advisory noted), `pnpm lint`, and scoped Prettier check on all ticket files.
- Published ready-for-review PR #24 (`https://github.com/RicardoFernandes99/DWC/pull/24`) via `gh stack submit --auto --open` against `main` (`f07f37d887e86d930fde9dcdd8728bd3f2f092a9`). Reviewed implementation commit: `5d934aa`.

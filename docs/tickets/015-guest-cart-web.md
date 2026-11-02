# 015: Keep a multi-producer cart across refresh and buyer login

- Macro: M03
- Status: In review
- Depends on: 014
- PR: https://github.com/RicardoFernandes99/DWC/pull/25
- Branch / parent: codex/age-015-guest-cart-web (stacked on codex/age-014-public-catalogue-web)
- Blockers: None beyond dependencies

## Outcome

Visitors add products from different producers, adjust quantities and keep their
cart when refreshing or signing in as a buyer.

## Read first

[Cart](../product-decisions.md#public-browsing-catalogue-and-cart),
[stock failures](../product-decisions.md#checkout-stock-and-payment),
[web guidance](../../apps/web/AGENTS.md), catalogue and session modules.

## Scope and contract

- Add cart actions/list grouped by producer, quantity edits and line removal.
  Persist only a versioned bounded cart with product IDs and quantities plus
  optional display hints. Validate restored data; storage is untrusted.
- Refresh product data using public APIs. Cached prices/stock are presentation,
  not checkout authority. No stock is reserved by adding to cart.
- Anonymous carts survive buyer login. Producer accounts cannot purchase; explain
  that role restriction without deleting the guest cart. Do not build cross-device
  synchronization or silently merge carts across different signed-in buyers.
- Apply existing account-cache isolation on logout/switch. Preserve a guest cart
  intentionally, without leaking previous buyers' account/order/payment data.
- Style unavailable lines distinctly with explicit stock/unavailable text, quantity
  guidance and accessible feedback. Checkout remains gated until 018 exists.

## Acceptance criteria

- [x] Mixed-producer lines survive refresh and guest-to-buyer sign-in.
- [x] Invalid storage cannot produce crashes, negative quantities or forged totals.
- [x] Sold-out/suspended-product refusals remain understandable and removable.
- [x] Quantities obey 010 precision; adding to cart does not reduce server stock.
- [x] Mobile/tablet/desktop and keyboard controls work without horizontal overflow.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Add mixed-producer lines as a guest, refresh, log in as a buyer and adjust/remove a stale line. Check malformed saved cart data does not crash the page.

## Delivery notes

Implemented multi-producer guest cart persisted in localStorage across refresh and buyer login:

- Safe, resilient parsing for untrusted `localStorage` data (`dwc_cart_v1`) rejecting invalid IDs, negative or fractional numbers, and bounding quantities to 999. Totals and prices are derived strictly dynamically from live `/api/products/:id` data.
- Live line status detection (`available`, `sold_out`, `insufficient_stock`, `unavailable`) with clear guidance and quick adjustment/removal actions.
- Producer grouping with per-producer and order-wide subtotals.
- Dedicated accessible `/cart` page with gated checkout flow, buyer sign-in return navigation, producer role purchase warning banners without cart deletion, and empty state featuring `@/components/shared/product-card.tsx` recommendations.
- Quick add on product cards and full quantity selector on product detail page with dynamic header navigation counter.

### Frontier Review

- Verdict: APPROVED
- Checks verified:
  - `pnpm --filter @dwc/web test src/features/cart/`: 11 unit & integration tests passing.
  - `pnpm --filter @dwc/web typecheck`: Clean (0 errors).
  - `pnpm --filter @dwc/web build`: Clean with React Compiler output verified.
  - `pnpm --filter @dwc/api build`: Clean (0 errors).
  - `pnpm eslint`: 0 errors across all touched files.
- PR: https://github.com/RicardoFernandes99/DWC/pull/25
- Base: `codex/age-014-public-catalogue-web` (PR #24)

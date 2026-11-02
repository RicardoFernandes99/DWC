# 015: Keep a multi-producer cart across refresh and buyer login

- Macro: M03
- Status: In progress
- Depends on: 014
- PR: Not opened
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

- [ ] Mixed-producer lines survive refresh and guest-to-buyer sign-in.
- [ ] Invalid storage cannot produce crashes, negative quantities or forged totals.
- [ ] Sold-out/suspended-product refusals remain understandable and removable.
- [ ] Quantities obey 010 precision; adding to cart does not reduce server stock.
- [ ] Mobile/tablet/desktop and keyboard controls work without horizontal overflow.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Add mixed-producer lines as a guest, refresh, log in as a buyer and adjust/remove a stale line. Check malformed saved cart data does not crash the page.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

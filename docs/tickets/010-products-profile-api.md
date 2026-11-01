# 010: Manage producer profiles, products and stock

- Macro: M03
- Status: Blocked
- Depends on: 009
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Agree product units, quantity precision and category/production-method values

## Outcome

Approved producers maintain their own profile and catalogue products with validated
prices, quantities and low-stock thresholds.

## Read first

[Catalogue](../product-decisions.md#public-browsing-catalogue-and-cart),
[dashboard](../product-decisions.md#producer-dashboard),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), application/eligibility services from 007/009.

## Scope and contract

- Introduce product schema/module with producer reference, name/description,
  category, production method, season values, integer EUR cents, unit, available
  stock, image metadata, published state and per-product low-stock threshold.
- Resolve the blocker before final DTO/schema design. Keep quantity arithmetic
  consistent with the chosen precision; do not assume whole units or binary floats.
- Owner routes: `GET/POST /api/producer/products`, `GET/PATCH /:id`, and an archive
  action. Pending/rejected/suspended users cannot create products. Owner writes
  enforce permitted status and revisions in their acceptance boundary.
- `GET/PATCH /api/producer/profile` edits approved producer profile fields. Keep
  approval/moderation fields server-owned. Public projections belong to 013.
- Archive preserves references for orders/auctions. Stock edits cannot silently
  overwrite concurrent reservations; use revision checks and explicit conflicts.
- Return owner DTOs with revision; add only real query/ownership indexes. Image
  upload is 011. Do not implement auctions/orders early.

## Acceptance criteria

- [ ] Approved producers manage only their own profiles/products.
- [ ] Prices, stock and thresholds validate against agreed units; secrets never leak.
- [ ] Stale stock edits conflict rather than erasing reservations or newer edits.
- [ ] Archive preserves history; public visibility respects eligibility/moderation.
- [ ] Pending/rejected/suspended creation and privileged-field changes fail.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Once product-value choices are agreed, create/edit/archive a product and try a foreign-owner or stale-stock edit. Inspect the actual persisted quantities.

## Delivery notes

Not implemented. Resolve the named blocker before starting; record evidence/PR here.

# 010: Manage producer profiles, products and stock

- Macro: M03
- Status: In review
- Depends on: 009
- PR: https://github.com/RicardoFernandes99/DWC/pull/20
- Branch / parent: `codex/age-010-products-profile-api` / `codex/age-009-producer-admin-decisions-api` at `92f778065d9ba9928bdd248ff0ebceeaff0752de`
- Blockers: None (product units, integer quantity precision, categories, production methods and seasons agreed in `docs/product-decisions.md`)

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
- Use the agreed enums and integer quantity precision (`step = 1`, non-negative
  integers across stock and low-stock thresholds):
  - `ProductUnit`: `unit`, `bunch`, `box`, `jar`, `bottle`, `bag`, `kg`, `g_500`, `g_250`, `l`, `ml_500`
  - `ProductCategory`: `vegetables`, `fruits`, `dairy`, `eggs`, `meat`, `bakery`, `pantry`, `beverages`, `other`
  - `ProductionMethod`: `organic`, `sustainable`, `conventional`, `artisanal`, `biodynamic`
  - `ProductSeason`: `spring`, `summer`, `autumn`, `winter`, `year_round`
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

- [x] Approved producers manage only their own profiles/products.
- [x] Prices, stock and thresholds validate against agreed units; secrets never leak.
- [x] Stale stock edits conflict rather than erasing reservations or newer edits.
- [x] Archive preserves history; public visibility respects eligibility/moderation.
- [x] Pending/rejected/suspended creation and privileged-field changes fail.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Once product-value choices are agreed, create/edit/archive a product and try a foreign-owner or stale-stock edit. Inspect the actual persisted quantities.

## Delivery notes

- Implemented on `codex/age-010-products-profile-api`, stacked on PR #19 (`codex/age-009-producer-admin-decisions-api` at `92f778065d9ba9928bdd248ff0ebceeaff0752de`). PR #20 is ready for review in stack #18.
- Agreed product decisions recorded in `docs/product-decisions.md`:
  - Discrete integer units (`unit`, `bunch`, `box`, `jar`, `bottle`, `bag`, `kg`, `g_500`, `g_250`, `l`, `ml_500`) with non-negative integer quantities (`step = 1`).
  - Categories: `vegetables`, `fruits`, `dairy`, `eggs`, `meat`, `bakery`, `pantry`, `beverages`, `other`.
  - Production methods: `organic`, `sustainable`, `conventional`, `artisanal`, `biodynamic`.
  - Seasons: `spring`, `summer`, `autumn`, `winter`, `year_round`.
- Orchestrator/reviewer: Gemini 4 Argon (Low). Builder subagent: `self` (`Model: 'inherit'` — Gemini 4 Argon Low, `b6d1874c-07c6-4c56-bd7f-802da96f8962`, transcript usage: 165,074 input tokens, 2,929,046 cached tokens, 26,238 output/thinking tokens), with zero subagent correction rounds.
- Frontier verdict: APPROVED against parent `92f778065d9ba9928bdd248ff0ebceeaff0752de` on reviewed implementation commit `8313a7dbedf8f26c2de6c7b869f3e366c900d0f6`.
- Static and contract checks passed with Node 24.22.2 and pnpm 11.25.0:
  - `pnpm contract:generate` and `pnpm contract:check`
  - `pnpm typecheck` (`tsconfig.tools.json`, `@dwc/api`, `@dwc/web`)
  - `pnpm lint` (`eslint . --max-warnings 0`)
  - `pnpm test` (`@dwc/web`: 15/15 tests; `@dwc/api`: 4/4 tests)
  - `pnpm build` (`@dwc/api` NestJS build and `@dwc/web` Vite + React Compiler build)
  - Scoped `prettier --check` on all 14 touched/created files
- Real HTTP, MongoDB replica-set and Redis verification on isolated port `3020`:
  - Approved producer `GET /api/producer/profile` (`200 OK`) and `PATCH /api/producer/profile` (`200 OK`, revision `2 -> 3`, preserving `city` naming across DTOs and `User.producerApplication`), stale revision (`409 Conflict`), privileged field injection (`status`/`producerStatus` -> `400 Bad Request`), and empty update (`400 Bad Request`).
  - Product creation `POST /api/producer/products` (`201 Created`, integer `priceCents`, integer `availableStock` and `lowStockThreshold`, `isLowStock: true` when `availableStock <= lowStockThreshold`, `revision: 1`), and fractional stock rejection (`400 Bad Request`).
  - Owner listing `GET /api/producer/products` (`200 OK`, paginated and filtered) and detail `GET /api/producer/products/:id` (`200 OK`).
  - Valid `PATCH /api/producer/products/:id` (`200 OK`, `availableStock: 25`, `isLowStock: false`, `revision: 2`), simultaneous competing stock updates at `revision: 2` resolved atomically (`[200, 409]`), stale stock revision edit (`409 Conflict`), and privileged field injection (`reservedStock` -> `400 Bad Request`).
  - Foreign-owner refusal by a second approved producer on `GET /:id`, `PATCH /:id`, and `POST /:id/archive` returned `404 Not Found` and left the product untouched in MongoDB.
  - Pending, rejected, and suspended producer refusals (`403 Forbidden`) and buyer refusals (`403 Forbidden`) across profile and product endpoints.
  - `POST /api/producer/products/:id/archive` (`200 OK`, sets `archivedAt` and `published: false`, excluded from default `GET /api/producer/products`, preserved in MongoDB and returned via `GET /api/producer/products?includeArchived=true` and `GET /api/producer/products/:id`, and returns `409 Conflict` on subsequent `PATCH` or repeat archive).
  - All temporary verification users, products, and Redis session keys were cleaned up after verification (`0` residual records).
- Limitations: Private S3 product image upload and signed preview URLs belong to Ticket 011; producer product/profile web screens belong to Ticket 012; public catalogue and producer profile projections belong to Ticket 013.

# 013: Search the public catalogue and view producer profiles

- Macro: M03
- Status: In progress
- Depends on: 010, 011
- PR: Not opened
- Branch / parent: `codex/age-013-public-catalogue-api` / `codex/age-012-producer-products-web` at `6edf8e2d89b27cdbab28c0d238c5c1b54ebe6d5e`
- Blockers: None beyond dependencies

## Outcome

Visitors discover eligible products and producer profiles through bounded public
queries. Suspended producers' normal-sale products are excluded server-side.

## Read first

[Public discovery](../product-decisions.md#public-browsing-catalogue-and-cart),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), product/profile models from 010.

## Scope and contract

- `GET /api/products` supports text, category, producer, location, season,
  production method, min/max price, sort and bounded pagination. Define typed
  query names/sort values in OpenAPI and reject invalid values. Escape/bound
  text matching; never pass arbitrary request objects into Mongo filters.
- Add public product detail, producer list/detail and producer-product queries.
  Public profile DTO includes approved display details/map coordinates, not email,
  application rejection data, payment or auth fields.
- Visibility requires published, unarchived, unmoderated product and currently
  eligible producer. Check current status, not copied product approval flags.
- Include price/unit/available stock and usable signed image access. Producer
  reviews/auctions can be added through 030/025 once real contracts exist; do not
  return fabricated ratings, auction records or misleading totals before then.
- Add indexes based on filter/sort needs and stable pagination ordering.

## Acceptance criteria

- [x] Combined filters, sorting and pagination return correct bounded results.
- [x] Suspended/archived/hidden products cannot be fetched through direct public IDs.
- [x] Producer details reveal only intended public fields and legitimate image access.
- [x] Malformed IDs, ranges, pagination and hostile text are handled safely.
- [x] Empty results are a valid response; queries need no authentication.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Try combined filters/pagination and direct access to a hidden or suspended listing. Check public responses contain no private account fields.

## Delivery notes

Implemented on `codex/age-013-public-catalogue-api`, stacked on PR #22. Frontier verdict: APPROVED after one verification correction round. No blocking code findings remain. Orchestration/review used the active session model; execution used `gpt-6-luna` at Medium. No model adaptation. Total token usage and cost are unavailable.

- Manual API check on the running local MongoDB/Redis/Floci services used uniquely
  identified producer/product fixtures and removed those records and the fixture
  image in cleanup. Three matching products passed the combined category,
  producer, city, season, method, price, sort and pagination query. Price ascending
  and descending used stable ObjectId tie breaks; page 1/page 2 had the same total
  and no duplicate IDs. Name and newest sort order matched fixtures. Unpublished,
  archived, moderated and suspended-producer products were each excluded from
  listing and returned 404 by direct ID. Suspending the fixture producer removed
  products and profile from public results; restoring Approved made its listings
  visible again. Producer and product DTOs omitted email, password hash, rejection
  reason, collection address and moderation fields. The signed image URL returned
  the stored bytes. Literal `[` and `.*` searches returned no false matches.
  Invalid page/limit/enums, repeated season, Mongo-style unknown query property,
  inverted price range and malformed ID returned 400. Empty unauthenticated
  results returned 200.
- API typecheck and Nest build passed. Web typecheck and production build passed;
  React Compiler output was verified. Root ESLint and scoped Prettier checks passed.
  OpenAPI export and generated Web schema drift checks passed.
- Checks used Node 24.22.2 and cached workspace dependencies. The exact commands
  (PowerShell, repository root unless a working directory is shown) were:
  - API typecheck: `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' 'C:\Users\Ricardo\AppData\Local\node\corepack\v1\pnpm\11.25.0\bin\pnpm.cjs' --filter @dwc/api typecheck`.
  - API build (working directory `apps/api`): `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' node_modules/@nestjs/cli/bin/nest.js build`.
  - Web typecheck/build (working directory `apps/web`): `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' ../../node_modules/typescript/bin/tsc --noEmit`, `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' node_modules/vite/bin/vite.js build` and `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' scripts/check-compiler.ts`.
  - Root lint: `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' node_modules/eslint/bin/eslint.js . --max-warnings 0`.
  - Formatting: `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' node_modules/prettier/bin/prettier.cjs --check apps/api/src/catalogue/*.ts apps/api/src/app.module.ts apps/api/src/export-web-contract.ts apps/api/src/products/product.schema.ts apps/api/src/users/user.schema.ts apps/web/openapi.json apps/web/src/lib/api-schema.ts README.md docs/tickets/013-public-catalogue-api.md`.
  - OpenAPI export: `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' apps/api/dist/export-web-contract.js`.
  - OpenAPI drift: `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' apps/api/dist/export-web-contract.js --check` and, from `apps/web`, `& 'C:\Users\Ricardo\AppData\Roaming\fnm\node-versions\v24.22.2\installation\node.exe' node_modules/openapi-typescript/bin/cli.js openapi.json -o src/lib/api-schema.ts --check`.
    Corepack's pinned pnpm shim attempted an unavailable network fetch, so cached
    pnpm was invoked directly for API typecheck and the local equivalent CLI
    entry points were used for the remaining checks. Web production build reported
    a 500 kB chunk-size advisory and completed successfully.
- Executor: Luna, Medium. Review round: 1. Token usage: unavailable.

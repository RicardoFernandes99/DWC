# 013: Search the public catalogue and view producer profiles

- Macro: M03
- Status: Draft
- Depends on: 010, 011
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Combined filters, sorting and pagination return correct bounded results.
- [ ] Suspended/archived/hidden products cannot be fetched through direct public IDs.
- [ ] Producer details reveal only intended public fields and legitimate image access.
- [ ] Malformed IDs, ranges, pagination and hostile text are handled safely.
- [ ] Empty results are a valid response; queries need no authentication.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Try combined filters/pagination and direct access to a hidden or suspended listing. Check public responses contain no private account fields.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

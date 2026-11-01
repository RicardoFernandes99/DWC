# 031: Review a producer once per completed order and report reviews

- Macro: M06
- Status: Draft
- Depends on: 019, 028
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Buyers review producers after delivery/collection, including auction orders, and
users can report reviews for administration.

## Read first

[Review rules](../product-decisions.md#notifications-and-reviews),
[API guidance](../../apps/api/AGENTS.md), order models and public producer API 013.

## Scope and contract

- Introduce review schema: author/order/producer references, integer rating 1-5,
  optional bounded plain-text comment, visibility and timestamps. Database unique
  order index prevents duplicate reviews under concurrent requests.
- Buyer create accepts order ID/rating/comment; derive author/producer from the
  owned completed order. Accept delivered or collected only, including auction origin.
- Public paginated producer-review endpoint and visible-rating aggregate exclude
  moderated-hidden reviews. Explicit DTOs omit private order/account information.
- Authenticated report action records reviewer/reason with deduplication and no
  public exposure of reporter identity. Moderation operations are 036.
- No per-product ratings, speculative recommendation system or automatic hiding
  based solely on number of reports. Review editing/deletion is not agreed scope.

## Acceptance criteria

- [ ] One review per completed owned order; auction collection orders qualify.
- [ ] Pending/cancelled/foreign orders and invalid stars/comments fail appropriately.
- [ ] Concurrent duplicates result in one review and a handled conflict.
- [ ] Hidden reviews are absent from public lists and rating totals.
- [ ] Report retries do not duplicate reports or expose reporter/private order data.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Review a completed delivery/collection order, retry it and report a review. Check a pending/foreign order is refused and hidden-review totals are correct.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

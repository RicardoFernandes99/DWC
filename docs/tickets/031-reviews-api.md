# 031: Review a producer once per completed order and report reviews

- Macro: M06
- Status: In review
- Depends on: 019, 028
- PR: https://github.com/RicardoFernandes99/DWC/pull/45
- Branch / parent: `codex/age-031-reviews-api` on `codex/age-030-live-auction-web` (PR #44, `f81929e`); native stack #34
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

- [x] One review per completed owned order; auction collection orders qualify.
- [x] Pending/cancelled/foreign orders and invalid stars/comments fail appropriately.
- [x] Concurrent duplicates result in one review and a handled conflict.
- [x] Hidden reviews are absent from public lists and rating totals.
- [x] Report retries do not duplicate reports or expose reporter/private order data.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Review a completed delivery/collection order, retry it and report a review. Check a pending/foreign order is refused and hidden-review totals are correct.

## Delivery notes

- Orchestrator/reviewer: Claude Opus 5.5. Builder: Claude Sonnet (Agent tool), one handoff, 0 correction rounds. Usage measurements unavailable.
- User decisions: public reviews show the reviewer first name only; reports need a category (spam, offensive, off_topic, false_information, other) plus an optional note up to 500 characters.
- Frontier verdict: APPROVED on implementation `29b75bd` (parent `f81929e`).
- Checks on `29b75bd`: API typecheck and build, `pnpm contract:check`, web
  typecheck, root lint, scoped Prettier: pass.
- Real-stack fixture `demos/ticket-031-review/review-api.ts` against Mongo/Redis
  and the built API (port 3131, `REVIEW_API` env): 14/14 groups pass. Covers delivered and auction-collected reviews, a retry 409, a concurrent duplicate pair (one 201, one 409, DB count 1), pending/cancelled/shipped 409, foreign 404, invalid input 400, public pagination and summary, a hidden review excluded from list and totals, report dedupe/own 403/hidden 404/401, and no private data in public output. The fixture cleans only its own records.
- Limitations: no hide endpoint until 036 (hidden state set in Mongo for verification); the concurrency check is a real race, not exhaustive.

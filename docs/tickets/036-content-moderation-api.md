# 036: Hide products and reported reviews through admin APIs

- Macro: M08
- Status: Draft
- Depends on: 009, 013, 031
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Admins inspect products/review reports and hide content without deleting historical
orders, reviews or product references.

## Read first

[Admin/review decisions](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), product/review public projections.

## Scope and contract

- Add bounded admin product/review-report lists and details. Include report reasons
  only in authorized admin responses; avoid leaking reporter identity publicly.
- Owner-independent admin hide actions record reason, actor/time and revision.
  Preserve the record, producer publication choice and historical snapshots.
- Hidden products disappear from public list/detail/quote/checkout and cannot mint
  fresh public image access. Existing orders remain intact.
- Hidden reviews disappear from public lists and rating aggregates consistently.
  Admin reads still show moderation state and reports.
- Do not silently hide active auctions or rewrite an auction's reserved lot when
  its source product is moderated; current auction commitments follow auction rules.
- No automatic takedown threshold, review response feature or public moderation page.

## Acceptance criteria

- [ ] Admin can inspect/report context and hide the intended resource.
- [ ] Other roles cannot use admin routes; private report data stays private.
- [ ] Hidden product direct access/checkout and hidden review aggregates are excluded.
- [ ] Repeated/stale moderation actions are handled without duplicate outcomes.
- [ ] Existing order/auction snapshots and producer-owned records remain stored.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Hide one product and one review, then inspect public views/totals and preserved order history. Try the same action as a non-admin.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

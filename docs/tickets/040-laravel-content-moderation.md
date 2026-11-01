# 040: Moderate products and reported reviews in Laravel

- Macro: M08
- Status: Draft
- Depends on: 036, 038
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Admins can inspect reported content and hide products/reviews through a focused
Laravel interface backed by NestJS moderation services.

## Read first

[Moderation decisions](../product-decisions.md#laravel-administration-and-suspension),
backoffice guidance from 038, moderation API 036 and public screens 014/032.

## Scope and contract

- Add paginated product/review moderation lists, report context/detail and a hide
  action with required reason/confirmation. Use safe plain-text rendering.
- Display actual moderation status and preserved historical context. Do not add
  hard-delete buttons, arbitrary role changes or direct MongoDB mutations.
- Handle stale revisions, unavailable API and authorization expiry using shared
  backoffice conventions. A failed action never displays a successful takedown.
- Keep private reporter details behind admin authorization and out of public links.
  Public product/review exclusion and rating changes remain the API's responsibility.
- No automated report threshold, public moderation feed or review response editor.

## Acceptance criteria

- [ ] Admin can inspect and hide the intended content with recorded reason.
- [ ] Product/review disappears from relevant public views after refresh.
- [ ] Historical orders/auctions remain inspectable and unaffected.
- [ ] Stale/API failures and session expiry have useful, non-destructive feedback.
- [ ] Content rendering, keyboard actions and responsive layouts work safely.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and manually hide a product/review. Verify public exclusion and safe rendering of a markup-like comment.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

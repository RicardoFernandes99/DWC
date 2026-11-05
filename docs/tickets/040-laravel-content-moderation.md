# 040: Moderate products and reported reviews in Laravel

- Macro: M08
- Status: In progress
- Depends on: 036, 038
- PR: Not opened
- Branch / parent: `codex/age-040-laravel-content-moderation` / PR #53, `codex/age-039-laravel-producer-decisions`
- Blockers: None

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

- [x] Admin can inspect and hide the intended content with recorded reason.
- [x] Product/review disappears from relevant public views after refresh.
- [x] Historical orders/auctions remain inspectable and unaffected.
- [x] Stale/API failures and session expiry have useful, non-destructive feedback.
- [x] Content rendering, keyboard actions and responsive layouts work safely.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and manually hide a product/review. Verify public exclusion and safe rendering of a markup-like comment.

## Delivery notes

- Laravel product and reported-review lists, details, confirmed hide actions, scoped reason drafts and sanitized recovery pages consume the existing moderation API. The home links, backoffice README and project scope are updated. The screens distinguish moderation from publication and archiving and preserve private report context.
- Builder: `gpt-6-luna`, High. Frontier verdict APPROVED after three correction rounds. Fixes separated review metadata, kept state badges readable, constrained long names, simplified the review heading and clarified error copy. The final title-safety investigation confirmed Laravel already escapes inline title sections; the shared layout is unchanged. Usage figures are unavailable.
- Parent verified through authenticated `gh`: open PR #53 at `09749fb212f07600b4f5edca8c53a401fe252b02`. The new branch was created through native `gh stack add` in stack #34. No PR has been opened for 040.
- Checks completed: root ESLint and tools TypeScript check passed; scoped Prettier and `git diff --check` passed. Backoffice `composer check-platform-reqs` passed on PHP 8.4.27, Pint `--test` passed across 39 files, and Larastan reported no errors. The real browser/API fixture passed, including responsive pages at 390/768/900/1440 pixels, a product-title script payload rendered as literal text without execution, CSRF and required-reason checks, stale conflict recovery, current-role revocation, malformed list/detail payloads, public product/review exclusion and rating refresh, and unchanged admin order/auction inspection snapshots. CSS taste lint reports zero failures; the existing micro-label and Orchard cream palette warnings are retained for the established backoffice style. Final screenshots and sanitized HTML are saved under `demos/ticket-040-review/`; the before/after home screenshots use the parent comparison app.
- Docker's stale runtime-file issue was resolved after explicit user approval through a backed-up runtime-folder repair. No database volume was removed or reset. The temporary backoffice/API/browser fixture deletes only its tagged users, sessions, products, reviews, reports, notifications, order and auction records. The last fixture run passed the exact API-session revocation and Laravel-session cleanup assertions; a cleanup-only call was added afterward to capture the new anonymous Laravel session created by the probe's role-revoked redirect, and that final one-line helper adjustment has not been rerun.
- Final source CSS and product/review list/detail inspectors report zero failures. Retained warnings cover Orchard's existing cream/context label, valid 16-pixel mobile gutters, and the established centered standalone error layout. Screenshots were also judged for hierarchy, wrapping, alignment, action placement and recovery. Realistic content and a 120-character farm-name boundary were exercised. No sample data is shipped in the application.
- Limitations: the UI displays the API's current moderation record, not an invented audit log. Restore endpoints remain API-only. No API business rules changed. Preserve unrelated producer-application controller line-ending edits and all existing local demo/temp artifacts.

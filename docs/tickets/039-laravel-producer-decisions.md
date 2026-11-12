# 039: Review producer applications and suspension in Laravel

- Macro: M08
- Status: In review
- Depends on: 035, 038
- PR: [#53](https://github.com/RicardoFernandes99/DWC/pull/53), ready for review in native stack #34
- Branch / parent: `codex/age-039-laravel-producer-decisions` / `codex/age-038-laravel-auth-foundation` at `89f1f2de2f4759ac6daa46b37330b66f825fa8be` (PR #52)
- Blockers: None beyond dependencies

## Outcome

An administrator reviews producer applications, approves/rejects with reasons and
suspends/reinstates producers using the authoritative NestJS APIs.

## Read first

[Onboarding/admin decisions](../product-decisions.md#accounts-and-producer-onboarding),
backoffice guidance created by 038, API contracts 009/035 and shared ticket standards.

## Scope and contract

- Add paginated application list/detail with submitted profile/location data,
  status, prior reason and permitted approval/rejection actions.
- Rejection requires a reason; stale revision conflicts refresh current application
  instead of overwriting a newer decision. No direct MongoDB writes from Laravel.
- Add producer suspension/reinstatement controls with reason and confirmation of
  their actual effect: hidden normal-sale products, blocked new sales, existing
  orders/active auctions continue. Keep these separate from application approval.
- Use typed/validated API boundary conventions established in 038, not stringly
  typed duplicated status constants. Domain decisions remain in NestJS.
- Do not add buyer suspension controls until 042 resolves that policy.

## Acceptance criteria

- [x] Admin completes approval/rejection/resubmission review using real API results.
- [x] Producer sees the corresponding current status/reason/notification.
- [x] Suspension/reinstatement respects prior approval and moderation visibility.
- [x] Stale actions/API failures preserve meaningful forms and display actual errors.
- [x] Keyboard, labels and responsive backoffice views are usable.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and manually approve/reject/suspend a producer through the API-backed screens. Verify status feedback and one stale/non-admin refusal.

## Delivery notes

- Published against PR #52 with frontier APPROVED on implementation revision
  `f1504980182b82fa7cfd981813c914c4cba18323`. The subsequent publication metadata
  update changes documentation only. No merge was performed.
- Added Blade application list/detail with status filters and bounded 20-row
  pagination, submitted farm/location details, reasons and separate review and
  standing controls. PHP validates API responses into typed DTOs and enum-backed
  statuses. NestJS remains the authority; no API implementation changed.
- Every route checks current administrator identity, uses the existing session
  lock and protects POST forms with CSRF. Mutations send an integer revision
  once. A 401/403 clears the Laravel session and attempts API revocation.
- Stale conflicts fetch the current record and retain a producer/action-scoped
  reason draft. A draft cannot fill a different action's form. Bounded drafts
  survive an identity-check 503 before the controller; that screen says no
  decision was sent. Mutation failures instead show an unknown outcome and a
  status-refresh link. Neither path retries the mutation.
- Builder: `gpt-6-luna`, high effort, resumed after a reported usage limit when
  the user confirmed availability. Frontier verdict APPROVED after three
  correction rounds: action-scoped recovery, scoped CSS formatting and
  identity-gate outage recovery. Trivial frontier fixes added textarea font
  inheritance, matched the API's character-based name limit and clarified documentation. Token/cache/cost measurements were
  not exposed and are unavailable.
- Checks passed: `pnpm backoffice:format`, `pnpm backoffice:check` with platform
  checks, Pint on 33 PHP files and Larastan; root ESLint, tools TypeScript check,
  scoped Prettier, `git diff --check` and a valid 100-character Unicode name at
  the PHP API boundary. No Node application code or contract
  changed, and Laravel has no JavaScript build.
- Real Chrome/NestJS evidence under `demos/ticket-039-review/` covers rejection,
  resubmission, approval, changed-revision and opposite-decision conflicts,
  suspension/reinstatement, producer reasons and all four notification types,
  product visibility, blocked new sales, retained moderation, buyer/current-role
  refusal, required reason, keyboard order, missing-token CSRF 419 and credential
  isolation. Separate proxy-backed probes verify business 503, malformed API
  responses and identity-check 503 with zero forwarded mutations and recovered
  drafts. Disposable records and ticket-owned probe resources were cleaned up.
- Screenshots cover 390, 900 and 1440 pixels, including populated/empty lists,
  decisions, conflicts, confirmations and errors. Actual rendered HTML snapshots
  have CSRF values removed and the real CSS/font embedded for protected-screen
  layout inspection. Final list/detail/error inspector gates report zero failures.
  Retained warnings reflect Orchard's palette/context labels and the existing
  centered standalone error-page composition. Design draw: Accent ladder,
  seed 964004711, keeping palette/type. The home replaces the parent empty-shell
  message with a working review entry point; prior 038 images provide the before.
- Limits: this is functional/visual evidence, not a multi-worker load test.
  Existing order and active-auction rules remain in the unchanged 035 APIs;
  their full domain checks were not repeated. Local Windows PHP requests are
  slow. Pre-existing API line-ending edits and unrelated demo/temp files remain
  excluded from this ticket.

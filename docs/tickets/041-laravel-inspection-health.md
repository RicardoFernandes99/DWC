# 041: Inspect marketplace records and health in Laravel

- Macro: M08
- Status: In review
- Depends on: 037, 038
- PR: https://github.com/RicardoFernandes99/DWC/pull/55
- Branch / parent: `codex/age-041-laravel-inspection-health` / `codex/age-040-laravel-content-moderation`
- Blockers: None beyond dependencies

## Outcome

Administrators inspect users, orders, auctions and service health from read-only
backoffice pages.

## Read first

[Admin scope](../product-decisions.md#laravel-administration-and-suspension),
backoffice guidance from 038 and inspection API 037.

## Scope and contract

- Add bounded, server-paginated lists/detail with the filters supported by 037.
  Follow order/auction/user links through validated IDs and safe routing.
- Show historical line amounts, delivery fees, refund states and linked auction
  settlement without recomputing them from current product prices.
- Add service-health view using sanitized dependency status, refresh/error handling
  and readable last-check time. Do not expose raw configuration or logs.
- All pages remain admin-only, read-only and API-driven. No repair-state buttons,
  exports, impersonation or speculative admin analytics.
- Preserve normal order/auction vocabulary for both fulfilment methods and cancelled
  orders; unknown/new API state should fail visibly rather than be cast silently.

## Acceptance criteria

- [x] Admin finds correct records across pagination/filter/navigation.
- [x] Store/auction/refunded orders show accurate snapshots and related IDs.
- [x] Health degradation is visible with no secret leakage or endless spinner.
- [x] Non-admin/expired-session access and API errors are handled consistently.
- [x] Read-only pages remain usable on all screen ranges and by keyboard.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and inspect representative records plus a degraded health state. Confirm these screens do not send domain write requests.

## Delivery notes

Frontier **APPROVED** after three correction rounds. Ready-for-review PR 55 is
stacked on PR 54 through native `gh stack`, stack 34. Reviewed implementation
commit: `2f933a7b41749384fb1d9e3bfbe1bc270c7cbcb0`.

- Parent PR 54 at `b84ea867765cbf1638bb1972dbf937886be82202`; existing checkout,
  no worktree. API dependency 037 and Laravel authentication 038 are present.
- Executor: `gpt-6-luna`, High. The account usage interruption was resolved and
  the same executor resumed. No model switch. Usage and cost measurements were
  unavailable. The frontier made no production-code edits.
- User confirmed health checks on page load and explicit Refresh only. The page
  labels Laravel's completed-request time rather than inventing an API timestamp.
- Users, orders and auctions have supported filters, page sizes of 20 or 50,
  bounded page navigation through 500, details and validated related links.
  Auction bid history is paginated independently. Stored line prices, delivery
  fees, refund allocations and settlement amounts remain API-authoritative.
- Malformed DTOs, omitted financial keys and unknown states fail visibly. API
  401/403, a current role downgrade and revoked sessions clear Laravel access.
  All routes retain the current-admin gate, session locks and no-store responses.
- Complete real API/Laravel browser pass: `demos/ticket-041-review/result.txt`.
  It covers lists/filter/page navigation, refunded delivery and collected auction
  snapshots, related links, literal escaped text, invalid queries, missing IDs,
  keyboard/mobile disclosure and resizing, healthy/degraded health, no polling,
  one-request manual refresh, bounded timeout, malformed/unknown/mismatched DTOs,
  page 500, non-admin/revoked access and identity-gate failure. Fixture domain
  documents were unchanged; the instrumented proxy observed zero domain writes.
- Degradation uses an isolated real API process with an unavailable storage
  endpoint. Other failure cases use a forwarding fault-injection proxy. Shared
  services and data were preserved; only disposable fixture IDs and exact known
  session keys/files were cleaned. No persistent administrator credentials.
- The final change grouped the optional auction link within its existing order
  row. Focused browser verification in `result-layout.txt` passed aligned Created
  columns and working auction/settlement links at 390, 768, 900 and 1440 px.
  Earlier checks remain valid for the unchanged behavior.
- Pint passed on the 19 owned PHP/Blade files, plus each later changed Blade
  template. Larastan reported no errors. PHP 8.4.27 platform requirements and
  Blade view caching passed; final changed views also compiled through real
  requests. Root tools TypeScript and scoped Prettier passed. Root ESLint passed
  with the unrelated untracked ticket 040 review script excluded; unfiltered
  local lint found that preserved artifact's existing prefer-const error.
- Interface-design and taste-skill app guidance retained Orchard's palette,
  Fraunces headings, flat ruled lists and native controls. Accent ladder seed
  964004711 kept palette/type. Actual screenshots and sanitized HTML cover the
  home, all lists/details, pagination, empty/validation/error and health states
  at 390/768/900/1440. Final inspectors reported zero failures. Existing cream and
  context-label warnings are intentional brand consistency; sparse health and
  filtered lists show only real data; standalone errors retain the existing
  centered message layout. No new font, framework, chart or animation.
- The Windows demo helper failed on Bash path conversion; direct Playwright with
  installed Chrome captured actual implemented UI. Home-before images reuse the
  identical approved parent implementation. Fixture identities differ between
  passes. All evidence remains local under `demos/ticket-041-review/`.
- Three rounds fixed filter feedback/bounds/DTO validation and mobile density,
  current decision and settlement presentation; then disclosure resizing; then
  the mixed-origin order-row alignment. No API contract or domain write changed.
- Existing API controller line-ending changes and unrelated demo/temp artifacts
  are excluded from this ticket. No merge is authorized by this delivery.
- Review API processes, the isolated health API and Laravel container were
  stopped after verification. MongoDB, Redis and storage remain healthy. No
  listeners remain on the owned review ports 3000/3002/8080/8081/3141.

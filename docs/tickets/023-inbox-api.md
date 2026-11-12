# 023: Persist and read a private notification inbox

- Macro: M06
- Status: In review
- Depends on: 003
- PR: https://github.com/RicardoFernandes99/DWC/pull/37
- Branch / parent: `codex/age-023-inbox-api` / `codex/age-022-socketio-transport` at `60d1e16fc36346102c58501b3b0e36280fc68740`
- Blockers: None beyond dependencies

## Outcome

Each account can retrieve notifications missed offline and mark them read.

## Read first

[Notification rules](../product-decisions.md#notifications-and-reviews),
[API guidance](../../apps/api/AGENTS.md), user/session module and shared checks.

## Scope and contract

- Introduce notification schema/service with recipient, event type, bounded safe
  payload, resource reference, created/read timestamps and a unique deduplication
  key per recipient/source event. Index recipient/time and unread lookup.
- `GET /api/notifications` supports bounded stable pagination and unread filtering.
  Expose unread count and an owner-only mark-read action; repeated marking is safe.
- Notifications link to resources through typed references/approved relative paths,
  never arbitrary external URLs or stored executable HTML. Resource endpoints still
  enforce authorization when followed.
- Add a domain creation method usable with an existing MongoDB transaction so the
  source change and inbox record can commit together. No socket/side effects inside
  retryable transactions. Event producers are connected in 024/028.
- Do not add emails, push notifications, retention jobs or a generic messaging system.

## Acceptance criteria

- [x] Recipient sees only their inbox/count, including after a fresh session.
- [x] Pagination/read marking is stable and idempotent; another user's ID is refused.
- [x] Duplicate source event cannot create repeated notifications.
- [x] A rolled-back source transaction leaves no orphan notification.
- [x] DTO validation and expected failures are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create a local inbox record, read/mark it and try another account. Repeat its source key to check deduplication and compare unread count.

## Delivery notes

Implemented on `codex/age-023-inbox-api`, based on `60d1e16fc36346102c58501b3b0e36280fc68740` (PR 36 parent). Builder model: gpt-6-luna, high; formal correction rounds: 1; model adaptation: none; token/credit usage: unavailable.

Frontier review: APPROVED after the response-contract correction and real HTTP ownership/pagination plus MongoDB deduplication/rollback checks passed. The parent is [PR 36](https://github.com/RicardoFernandes99/DWC/pull/36). Existing unrelated web, shared documentation, skill and demo changes remain excluded and unstaged.

Reviewed implementation revision: `2f16ee0`. Published ready for review as [PR 37](https://github.com/RicardoFernandes99/DWC/pull/37) through native `gh stack submit --auto --open` in stack 34. No merge was performed. Event producer integration remains in ticket 024.

- Added authenticated inbox list, unread count and owner-scoped idempotent read routes. Cursor pages sort by creation time and Mongo ID; page size is capped at 50.
- Added recipient/source-event unique index and recipient/time plus unread lookup indexes. `NotificationsService.createNotification` accepts an existing Mongoose session and performs no socket or other external side effects.
- Chose event types for order creation/status, refund request/decision, producer approval/rejection and auction won/lost/closed. Resources are typed order, producer application or auction ObjectId references; no URL or HTML field is stored.
- Passed: API typecheck/build, Web typecheck, root lint, OpenAPI contract generation and drift check, and scoped Prettier check.
- Passed runtime verification against the local API on port 3001, MongoDB and Redis using `node --env-file=.env .temp/verify-notifications.ts`. The temporary ignored verifier registered two isolated buyers, logged them in, inserted unique-keyed notifications through the service, and checked account isolation, persistent list/count after a fresh login, unread filtering, same-timestamp cursor pagination, fractional limit/invalid unread/cursor refusals, owner-only `404`, repeat-read timestamp stability, deduplication, and transaction abort with no orphan. It logged out all sessions and asserted both test accounts and their notifications were removed.
- The existing port 3000 API was not listening. For the check only, started a separate API with PowerShell `$env:API_PORT='3001'; node --env-file=.env apps/api/dist/main.js` and stopped that process afterward. No other process or fixture was changed.
- Static checks passed: `corepack pnpm --filter @dwc/api typecheck`, `corepack pnpm --filter @dwc/api build`, `corepack pnpm --filter @dwc/web typecheck`, `corepack pnpm lint`, `corepack pnpm contract:check`, and scoped `corepack pnpm exec prettier --check ...`. The OpenAPI `nextCursor` type is `string | null`.

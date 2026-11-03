# 025: Show an unread inbox and live notification toasts

- Macro: M06
- Status: In progress
- Depends on: 004, 021, 024
- PR: Not opened
- Branch / parent: `codex/age-025-notifications-web` / `codex/age-024-order-approval-notifications` (PR #38, `e36c946a51f16483e1b1cbdd4c205c06cec11d52`)
- Blockers: None beyond dependencies

## Outcome

Signed-in users see live updates and can read missed notifications after returning.

## Read first

[Notifications](../product-decisions.md#notifications-and-reviews),
[web guidance](../../apps/web/AGENTS.md), session 004 and inbox/event contracts 022-024.

## Scope and contract

- Create one Socket.io connection per authenticated browser session, not per page.
  Update/reconnect with refreshed access tokens; disconnect on logout/account switch.
- Add inbox/unread indicator, pagination and mark-read using Query-owned data.
  Live events merge/deduplicate by notification ID and refresh authoritative count.
- Show restrained accessible toasts with legitimate internal links. Refresh order,
  application and relevant account queries when their events arrive; do not duplicate
  server state into a second global store.
- On reconnect/focus fetch missed inbox/current resource state. A socket connection
  is not proof there were no missed events. Avoid duplicate listeners/toasts under
  StrictMode and across route changes.
- Keep public browsing functional without a private socket. Auction public transport
  integration belongs to 030. Never announce every countdown tick to screen readers.

## Acceptance criteria

- [x] Online order/approval/refund events update UI without manual reload.
- [x] Offline events appear after reconnect, with accurate unread state.
- [x] Logout/account switch exposes no previous user's notifications or subscriptions.
- [x] Duplicate events and remounts do not double-count or duplicate toasts.
- [x] Inbox/toasts remain keyboard accessible at all screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Observe a live notification, disconnect/reconnect and switch accounts. Check unread state, listener cleanup and keyboard/responsive inbox access.

## Delivery notes

Implemented the private cursor-paginated inbox, unread indicator, mark-read controls,
accessible toasts and session-level Socket.IO transport. API and Web consume the
single type-only source in `packages/realtime-contracts`. Personal broadcast/auth
semantics are unchanged. The client validates event IDs, fetches authoritative
content, invalidates inbox/order/application/session queries, and reconnects after
token refresh. Logout clears private data/listeners; late session work is guarded.

Frontier verdict: APPROVED. Executor: gpt-6-luna, high effort. Zero formal
correction rounds; lifecycle refinements were completed before builder handback.
Token/cost measurements were unavailable.

Actual checks passed:

- API and Web typechecks; API build; Web production build with React Compiler
  verification; `pnpm contract:check`; root lint; scoped ESLint and Prettier.
- Real authenticated Chrome checks against NestJS/MongoDB/Redis and both Vite dev
  and production preview: 20-to-23 cursor pagination, mark-read 23-to-22 count,
  duplicate and malformed events, focused toast retention, one user-room socket
  after token refresh, offline/reconnect recovery, account-switch isolation,
  injected 503/retry, real order confirmation/refund decline/admin approval events.
- Production screenshots inspected at 390, 900 and 1440 pixels, including live,
  cached offline, recovered, empty and error states. Saved under
  `demos/ticket-025-review/`, excluded from Git. Review-owned data and sessions
  were removed; temporary app processes stopped.
- Existing session, route-access and account tests: 12 passed. Five existing
  producer-onboarding tests failed because mocked router context is missing in
  ProducerProducts. Reproduced all five using the parent pages module; unrelated
  source and tests were preserved.

Limitations: existing production chunk-size warning and Mongoose new-option
warnings remain. Toast lookup scans at most 500 records, then offers an inbox
link; paginated inbox access remains authoritative. Taste source lint reported
zero failures and two warnings, for existing-brand copy and the floating toast
shadow. Custom authenticated browser checks were used instead of the standalone
unauthenticated design inspector.

All pre-existing dirty order UI, shared documentation, build guidance, index.css,
and demo files were excluded. No merge was performed.

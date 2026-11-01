# 025: Show an unread inbox and live notification toasts

- Macro: M06
- Status: Draft
- Depends on: 004, 021, 024
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Online order/approval/refund events update UI without manual reload.
- [ ] Offline events appear after reconnect, with accurate unread state.
- [ ] Logout/account switch exposes no previous user's notifications or subscriptions.
- [ ] Duplicate events and remounts do not double-count or duplicate toasts.
- [ ] Inbox/toasts remain keyboard accessible at all screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Observe a live notification, disconnect/reconnect and switch accounts. Check unread state, listener cleanup and keyboard/responsive inbox access.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

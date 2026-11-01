# 023: Persist and read a private notification inbox

- Macro: M06
- Status: Draft
- Depends on: 003
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Recipient sees only their inbox/count, including after a fresh session.
- [ ] Pagination/read marking is stable and idempotent; another user's ID is refused.
- [ ] Duplicate source event cannot create repeated notifications.
- [ ] A rolled-back source transaction leaves no orphan notification.
- [ ] DTO validation and expected failures are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create a local inbox record, read/mark it and try another account. Repeat its source key to check deduplication and compare unread count.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

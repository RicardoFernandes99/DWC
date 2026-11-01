# 024: Notify users about producer decisions, orders and refunds

- Macro: M06
- Status: Draft
- Depends on: 009, 019, 020, 022, 023
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Real application events create persistent inbox records and live personal events
for the correct buyer or producer.

## Read first

[Notifications](../product-decisions.md#notifications-and-reviews),
services from 009/017/019/020, inbox 023 and Socket.io contract 022.

## Scope and contract

- Integrate approval/rejection decisions, new producer orders, fulfilment updates,
  buyer refund requests and producer refund decisions with inbox creation.
- Record inbox entries in the same transaction as business state where possible,
  then emit safe notification IDs/public payloads to recipient rooms after commit.
- Use stable source-event IDs so retries do not duplicate inbox entries. Concurrent
  status/refund operations still obey their existing acceptance predicates.
- A socket dispatch failure must not roll back or repeat an already committed order
  or refund. Inbox/reconnect fetch recovers missed live delivery; document this
  persistence-to-delivery gap rather than adding a queue for guaranteed toasts.
- No auction events yet; 028 uses the established publisher and inbox service.
  Notification payloads never contain card/auth data or unrelated application details.

## Acceptance criteria

- [ ] Each listed source event persists for its intended recipients.
- [ ] Online users receive it live; offline users find it on later inbox fetch.
- [ ] Rolled-back/refused writes generate no success event/inbox record.
- [ ] Retried writes do not duplicate notifications or business effects.
- [ ] Unavailable sockets do not turn a committed business operation into a retry loop.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Perform one approval, order transition and refund decision while the recipient is online/offline. Confirm persisted inbox recovery without a dedicated e2e suite.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

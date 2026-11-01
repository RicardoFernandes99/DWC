# 027: Accept atomic bids and broadcast live auction state

- Macro: M05
- Status: Draft
- Depends on: 005, 022, 026
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Eligible buyers bid on a whole auction lot while public watchers receive consistent
live state, including the agreed last-ten-second extensions.

## Read first

[Auction decisions](../product-decisions.md#auctions),
[API concurrency rules](../../apps/api/AGENTS.md), auction/payment/session modules.

## Scope and contract

- Add bid collection with auction/buyer references, amount, server time and bounded
  display snapshot. Public history is paginated and excludes account/payment details.
- Add public auction-room join/leave/state events with server time and current
  deadline. Personal rooms remain authenticated. Proposed viewer-count default:
  connected watching sockets, labelled viewers rather than unique registered users.
- Authenticated bid event uses request ID, auction ID, amount and buyer-owned saved
  payment method. Gateway calls a domain service and returns explicit success/refusal
  acknowledgement. Validate current buyer/session/method expiry for each bid.
- First bid may equal starting price; later minimum is current highest plus increment.
  Within a transaction, condition on current revision, active state and server time
  strictly before deadline; persist accepted summary/history consistently.
- If remaining time is under 10 seconds, set deadline to acceptance time +10 seconds.
  Exactly 10 seconds does not extend; refused/expired bids never extend. Broadcast
  accepted persisted state only after commit, including revised deadline/revision.
- Deduplicate retried bid request IDs so ack/network retries do not bid twice.
  Reconnect provides fresh state/history; no winner settlement implementation here.

## Acceptance criteria

- [ ] Guest watches; buyer needs valid session/card; producer/forged method bid fails.
- [ ] Equal simultaneous bids have one winner; every accepted bid has one history row.
- [ ] Starting/increment rules and <10s/10s/expired boundaries hold under concurrency.
- [ ] Retries do not duplicate bids; refusal produces actionable acknowledgement only.
- [ ] Public room counts/state and private room authorization remain isolated.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use two browser/socket clients for competing bids and a final-ten-second extension. Confirm history, deadline refusal and current state; a small race regression test is optional.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

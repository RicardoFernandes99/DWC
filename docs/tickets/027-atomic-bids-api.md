# 027: Accept atomic bids and broadcast live auction state

- Macro: M05
- Status: In progress
- Depends on: 005, 022, 026
- PR: Not opened
- Branch / parent: `codex/age-027-atomic-bids` on PR 40 (`codex/age-026-auction-scheduling`, `baa0122f63eaf7b677a6b64df0950c9b65f38636`)
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
- Add public `/auctions` namespace auction-room join/leave/state events with
  server time and current deadline. Personal rooms remain authenticated.
  Confirmed viewer count: connected watching sockets, labelled viewers; guest
  sockets are included and multiple tabs count separately.
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

- [x] Guest watches; buyer needs valid session/card; producer/forged method bid fails.
- [x] Equal simultaneous bids have one winner; every accepted bid has one history row.
- [x] Starting/increment rules and <10s/10s/expired boundaries hold under concurrency.
- [x] Retries do not duplicate bids; refusal produces actionable acknowledgement only.
- [x] Public room counts/state and private room authorization remain isolated.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use two browser/socket clients for competing bids and a final-ten-second extension. Confirm history, deadline refusal and current state; a small race regression test is optional.

## Delivery notes

Frontier verdict: APPROVED, zero formal correction rounds. Executor: `gpt-6-luna`
at High effort for transactional bidding, idempotency and deadline concurrency.
Usage and cost measurements are unavailable.

API/Web typechecks, API/Web production builds, root lint, scoped Prettier,
`git diff --check`, contract generation and `pnpm contract:check` passed.
The contract wrapper passed with network access after a sandbox Corepack DNS
failure. Existing Web bundle-size warning remains. No full test suite was run.
No UI changed; no screenshots were required.

The isolated live review at `demos/ticket-027-review/live-review.ts` used real
MongoDB, Redis-backed authentication and Socket.IO. It confirmed guest watching
and socket viewer counts, one winner from equal simultaneous bids, minimum-bid
refusal/acceptance, one history row per accepted bid, public history redaction,
request retry deduplication and payload mismatch refusal, per-bid session and
buyer-role checks, saved-method ownership/expiry checks, last-ten-second
extension, expired-auction refusal, and public/private namespace isolation.
The exact-ten-second predicate was evaluated directly against MongoDB `$$NOW`
and returned 10,000 milliseconds remaining with no extension. The harness logs
only its summary and removes its own fixtures/sessions and listener.

Delivery is process-local and best-effort after persistence; reconnect reads
recover authoritative state/history. Settlement belongs to ticket 028. Unrelated
order UI, guidance changes and pre-existing demos were excluded.

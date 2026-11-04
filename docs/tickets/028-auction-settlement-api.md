# 028: Close auctions and settle the winner exactly once

- Macro: M05
- Status: In progress
- Depends on: 017, 019, 023, 024, 027
- PR: Not opened
- Branch / parent: `codex/age-028-auction-settlement` / `codex/age-027-atomic-bids` (PR #41)
- Blockers: None

## Outcome

At the server deadline, an auction closes once, settles its winner and creates a
Confirmed collection order, or releases stock if nobody bid.

## Read first

[Auction settlement decisions](../product-decisions.md#auctions),
[refund limits](../product-decisions.md#order-tracking-and-refunds),
[API transactions](../../apps/api/AGENTS.md), order/payment and bid services.

## Scope and contract

- Use a bounded server lifecycle runner to find due active auctions. Closure must
  condition on the current deadline/revision so a concurrent accepted extension
  wins correctly. No client clock, in-memory winner or Redis-only auction authority.
- Transactionally close the auction, record simulated winning payment and create
  one confirmed collection order for the whole reserved lot. Snapshot winning
  amount once, charge no delivery fee and link order/payment/auction with uniqueness.
- Auction stock was reserved at creation; do not deduct it again at settlement.
  No-bid closure releases that stock once without republishing hidden products.
- Accepted bids preserve the saved method's last four digits and expiry in an
  immutable snapshot. The simulated payment succeeds at closure even if the
  method later expires or is removed. Expiry/removal generates a buyer warning
  to add a new card for future purchases and bids; it does not block the paid
  Confirmed order. The simulation has no random declines or online gateway.
  Database/technical failures leave the auction retryable and are logged.
- Existing accepted bids without a snapshot use their still-present owned
  payment method as a safe settlement fallback. If that method is missing, keep
  the auction due and log a retryable settlement failure; never fabricate card
  details or discard the winner.
- Persist participant/winner/producer result notifications with deduplication and
  emit personal/public completion events after commit. Active auctions still finish
  for suspended producers. A crash/retry must recover unfinished settlement safely.

## Acceptance criteria

- [x] Winner gets exactly one paid Confirmed collection order and producer receives it.
- [x] No-bid auction restores its lot once; winner settlement does not deduct twice.
- [x] Concurrent workers/retries and restart after failure cannot duplicate settlement.
- [x] A valid late extension cannot race with closure into premature settlement.
- [x] Notifications/public result agree with the committed winner and order.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Run the scoped fixture with `node --env-file=.env demos/ticket-028-review/verify-settlement.ts` against the local replica set. It checks rollback/retry, concurrent settlement, actual bid snapshot/deadline extension, expiry/removal warnings, no-bid stock release, paged participant notifications, public finished-auction listing, partial unique indexes, and catalogue order/payment coexistence. It removes only fixture-owned records.

## Delivery notes

- Executor: `gpt-6-luna`, High effort. Frontier verdict: APPROVED after one
  correction round. Usage and cost measurements were unavailable.
- Parent SHA: `f2fbe4d6c25eb8dac780b73bf7d548507ca3cab0`.
- Passed `pnpm contract:generate`, API typecheck, `pnpm contract:check` including
  API build, root lint, Web production build, scoped Prettier and diff checks.
- The scoped replica-set fixture passed settlement, rollback/retry, concurrency,
  actual bid snapshot and late extension, expiry/removal warnings, no-bid stock,
  102-bid notification paging, public listing, partial indexes and catalogue
  coexistence checks. The orchestrator independently reran it successfully.
- Local `demos/ticket-028-review/verify-gateway.ts` verified real Nest readiness,
  the lifecycle runner, a suspended producer's winning settlement, guest
  `auction.closed` delivery with only public fields, authoritative HTTP state,
  paid order/payment records and persisted producer/buyer notifications. Both
  fixtures removed their own records and stopped their own API listener.
- Live events remain best-effort after commit. Persisted inbox and HTTP reads
  recover missed events. Legacy bids missing both snapshot and owned method stay
  retryable with a logged failure. No real payment gateway or random decline is
  simulated. The full test suite was not run; existing Web bundle-size and
  Mongoose notification-upsert deprecation warnings remain.
- Unrelated skill, ticket-index and order UI changes, plus existing demo
  artifacts, were preserved and excluded from this ticket's commit.

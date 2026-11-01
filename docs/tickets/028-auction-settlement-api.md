# 028: Close auctions and settle the winner exactly once

- Macro: M05
- Status: Blocked
- Depends on: 017, 019, 023, 024, 027
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Agree payment-method expiry/removal and simulated payment-failure policy after accepted bids

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
- Resolve the named payment blocker before implementing the exceptional paths.
  Do not drop an accepted winner silently or invent online-gateway behavior.
- Persist participant/winner/producer result notifications with deduplication and
  emit personal/public completion events after commit. Active auctions still finish
  for suspended producers. A crash/retry must recover unfinished settlement safely.

## Acceptance criteria

- [ ] Winner gets exactly one paid Confirmed collection order and producer receives it.
- [ ] No-bid auction restores its lot once; winner settlement does not deduct twice.
- [ ] Concurrent workers/retries and restart after failure cannot duplicate settlement.
- [ ] A valid late extension cannot race with closure into premature settlement.
- [ ] Notifications/public result agree with the committed winner and order.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

After resolving settlement policy, close a winning and a no-bid auction, retry settlement and inspect order/payment/stock records. A focused crash/race check is optional.

## Delivery notes

Not implemented. Resolve the named policy blocker and record actual evidence here.

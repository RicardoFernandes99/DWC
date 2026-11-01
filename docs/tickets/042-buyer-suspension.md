# 042: Define and implement buyer suspension behavior

- Macro: M08
- Status: Blocked
- Depends on: 027, 028, 039
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Decide buyer login, purchases, active bids, winner settlement and existing-order/refund access during suspension

## Outcome

The agreed admin user-suspension capability extends to buyers with explicit rules
for existing commitments rather than inheriting producer restrictions accidentally.

## Read first

[Open decisions](../product-decisions.md#open-decisions),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
session/bid/settlement APIs and backoffice guidance from 038.

## Scope and contract

- Resolve the named policy questions with the user and record them in product
  decisions before writing guards/transitions. Existing accepted bids and paid
  orders cannot be silently abandoned by an invented blanket account lockout.
- Then add narrow admin buyer suspend/reinstate actions and Laravel controls with
  current-state authorization, reason/actor/time and stale-update protection.
- Apply the agreed behavior consistently across HTTP, Socket.io/private dispatch,
  checkout/bidding, refunds and settlement. Account banner/copy must reflect the
  chosen permissions rather than reusing producer-only text.
- Keep producer suspension unchanged. Do not broaden into ban appeals or automatic
  fraud detection. Split implementation further if the resolved policy requires it.

## Acceptance criteria

- [ ] Every listed policy question has an explicit recorded answer before building.
- [ ] Admin-only transitions and current-session enforcement match those answers.
- [ ] Existing orders/bids/settlement are handled consistently under suspension races.
- [ ] Buyer UI and admin controls reflect the real permissions and reasons.
- [ ] Reinstatement restores only the intended capabilities.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Once policy is agreed, use affected static checks and a short manual HTTP/socket/browser flow for suspension and existing commitments. Add a small regression check only if useful.

## Delivery notes

Not implemented. This is a deliberately blocked draft, not authorization to guess policy.

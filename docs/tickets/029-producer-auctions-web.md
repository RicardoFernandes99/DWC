# 029: Create and manage producer auction lots

- Macro: M05
- Status: Draft
- Depends on: 012, 026
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Approved producers select a product/lot, schedule an auction and manage it before
start with clear reserved-stock and eligibility feedback.

## Read first

[Auctions](../product-decisions.md#auctions),
[web guidance](../../apps/web/AGENTS.md), product UI and API 026.

## Scope and contract

- Add producer auction list/create/detail/edit screens with product selection,
  fixed lot quantity, starting price, increment and start/end inputs.
- Explain that bid price is for the whole lot and quantity is reserved from normal
  stock. Use product units/precision and authoritative available/reserved amounts.
- Convert displayed local dates deliberately to API timestamps; server decides
  whether creation/edit/cancel is timely. Handle stale stock/time 409 responses.
- Enable edits/cancel only pre-start; show locked active terms and explicit
  cancellation confirmation. Refresh product stock after successful reservation.
- Pending/rejected users see approval status; suspended producers see the agreed
  banner, existing records and permitted navigation without new-auction controls.
- Link public room when available; live history/winner display is completed in 030.

## Acceptance criteria

- [ ] Real create/edit/cancel updates both auction and available-stock UI correctly.
- [ ] Whole-lot price, dates, increments and quantity validation match the API.
- [ ] Refused late/stale changes show current server state without false success.
- [ ] Suspension/pending state cannot be bypassed through direct form URLs.
- [ ] Forms, confirmations and lists work with keyboard and all screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create/reschedule/cancel a lot, try a late or stale edit and inspect stock feedback. Check dates, form labels and responsive layout.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

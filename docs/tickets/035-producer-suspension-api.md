# 035: Suspend producers without interrupting existing commitments

- Macro: M08
- Status: Draft
- Depends on: 009, 013, 019, 026
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies; buyer suspension is separate ticket 042

## Outcome

An admin suspends/reinstates a producer; public normal-sale products disappear,
new sales stop and existing orders/active auctions continue.

## Read first

[Suspension rules](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), admin decisions/current eligibility services.

## Scope and contract

- Add admin-only suspend/reinstate producer actions with reason, actor/time and
  revision conflict handling. Preserve the prior approval state so reinstatement
  does not approve a previously unapproved producer accidentally.
- Current producer status controls public catalogue/detail/image eligibility,
  checkout acceptance, product creation and auction creation/start. Use domain
  predicates rather than a global account lockout or stale copied product flags.
- Hide normal-sale products without deleting or changing their publication flags.
  Reinstatement restores only otherwise eligible published products.
- Existing order fulfilment/refund obligations remain reachable. Active auctions
  finish normally; scheduled auctions follow the resolved policy from 026.
- Reuse the status/reason DTOs for account banners and admin views. Do not invent
  additional suspension-notification rules or duplicate the existing inbox system.
- No buyer suspension semantics or automatic cancellation of active auctions.

## Acceptance criteria

- [ ] Suspension hides list/direct catalogue access and prevents new stock sales.
- [ ] Existing-order actions and active bidding/settlement remain correctly permitted.
- [ ] Reinstatement cannot republish moderated/archived products or grant approval.
- [ ] Checkout/suspension and creation/suspension races have consistent acceptance.
- [ ] Non-admin, wrong account type and stale updates fail with documented errors.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Suspend/reinstate a local producer, verify hidden catalogue/direct links and retained existing-order/active-auction access. A focused suspension race check is optional.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

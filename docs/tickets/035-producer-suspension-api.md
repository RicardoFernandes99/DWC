# 035: Suspend producers without interrupting existing commitments

- Macro: M08
- Status: In review
- Depends on: 009, 013, 019, 026
- PR: [#49](https://github.com/RicardoFernandes99/DWC/pull/49) (ready for review, native stack #34)
- Branch / parent: `codex/age-035-producer-suspension-api` on `codex/age-034-producer-dashboard-web` (PR #48, `32aec23`)
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

- [x] Suspension hides list/direct catalogue access and prevents new stock sales.
- [x] Existing-order actions and active bidding/settlement remain correctly permitted.
- [x] Reinstatement cannot republish moderated/archived products or grant approval.
- [x] Checkout/suspension and creation/suspension races have consistent acceptance.
- [x] Non-admin, wrong account type and stale updates fail with documented errors.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Suspend/reinstate a local producer, verify hidden catalogue/direct links and retained existing-order/active-auction access. A focused suspension race check is optional.

## Delivery notes

- Decisions (user, 2026-11-04): only approved producers can be suspended and
  reinstatement only returns suspended producers to approved (other statuses 409);
  suspend and reinstate each send one inbox notification through the existing
  notification integration; the required suspension reason (1-500 chars) is
  visible to the producer as `suspensionReason`. Recorded in
  [product decisions](../product-decisions.md#laravel-administration-and-suspension).
- `POST /api/admin/producers/:id/suspend` (`{ revision, reason }`) and
  `/reinstate` (`{ revision }`), admin only, return the admin producer item.
  One transaction updates status, reason, `producerDecisionBy/At` and both
  revisions, persists the notification (`producer:<id>:decision:<rev>`) and
  publishes it after commit. 404 non-producer, 409 wrong status or stale revision.
- Races: checkout's producer fence was a no-op `$inc: { __v: 0 }` (no write
  conflict); it now increments `auctionEligibilityRevision`. Product creation now
  fences the approved producer and inserts in one transaction. Catalogue, image,
  checkout and auction predicates already used current status and were unchanged;
  order fulfilment/refund and bidding/settlement have no producer-status gate.
- Builder: Claude Sonnet (Agent tool), frontier review by Claude Opus 5.5.
  Verdict APPROVED after 0 correction rounds. One frontier fix: the suspension
  notification message is capped at 500 characters (notification schema limit),
  since prefix + a 500-char reason would fail validation.
- Checks on the reviewed revision: `pnpm --filter @dwc/api typecheck` and
  `build`, root `pnpm lint`, `pnpm contract:generate` then `contract:check`,
  `pnpm --filter @dwc/web typecheck` (builder), scoped Prettier and
  `git diff --check` pass.
- Real stack: API built from this branch on port 3131. The fixture
  `demos/ticket-035-review/suspension-api.ts` (kept local) passed 9/9 groups:
  refusals (401/403/400/404/409), suspend/notification, hidden list/detail,
  checkout quote/accept refused, product creation 403, existing-order action and
  own status with reason while suspended, reinstate restoring only published
  unmoderated unarchived products, and a concurrent checkout/suspend (500-char
  reason) with consistent order/stock outcome.
- Limitations: auction create/start for suspended producers and the scheduler
  were not re-exercised (code unchanged since 026). In the observed race the
  suspension won; the checkout-first ordering was not shown. A pre-suspended
  checkout accept answers 400 from the quote recheck (`producer_suspended`), the
  in-transaction path 409. The web banner does not yet show `suspensionReason`.
  No automated tests added; usage figures are unavailable.
- PR #49 is ready for review in native stack #34. The reviewed implementation commit is `3c0e273`.

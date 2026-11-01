# 008: Show producer approval and resubmission screens

- Macro: M02
- Status: Draft
- Depends on: 004, 007
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Producers understand their approval status and can submit or correct an application
without seeing working selling tools before approval.

## Read first

[Onboarding](../product-decisions.md#accounts-and-producer-onboarding),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
[web guidance](../../apps/web/AGENTS.md), and the account routes/client from 004.
Use the API from 007 and [shared checks](README.md).

## Scope and contract

- Extend `/producer` with application fields/status, pending confirmation and
  rejected-state reason plus correction/resubmission form.
- Pending producers see "Pending approval" instead of product/auction creation
  tools. Application details are not product drafts.
- Approved users can reach selling routes as those are implemented. Suspended
  users see the exact agreed banner and keep access to existing-order handling.
- Refresh current `/me` and application data after submission and on revisit.
  Notification-driven status refresh will be added in 024; no socket setup here.
- Preserve field values on validation/network failure; handle an admin decision
  racing a stale form by fetching current status. Do not infer approval locally.
- No React admin, role switcher or fake approval controls.

## Acceptance criteria

- [ ] Initial application, pending, rejected and suspended states are distinct.
- [ ] Rejected producers can correct/resubmit; rejected API writes show real errors.
- [ ] Pending users cannot reach creation forms through direct URLs as routes arrive.
- [ ] Buyer/guest navigation does not expose producer application data.
- [ ] Labels, keyboard/focus behavior and all three responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Check pending, rejected/resubmission and suspension views in a browser, including a failed submit and responsive/keyboard behavior.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

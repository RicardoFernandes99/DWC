# 039: Review producer applications and suspension in Laravel

- Macro: M08
- Status: Draft
- Depends on: 035, 038
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

An administrator reviews producer applications, approves/rejects with reasons and
suspends/reinstates producers using the authoritative NestJS APIs.

## Read first

[Onboarding/admin decisions](../product-decisions.md#accounts-and-producer-onboarding),
backoffice guidance created by 038, API contracts 009/035 and shared ticket standards.

## Scope and contract

- Add paginated application list/detail with submitted profile/location data,
  status, prior reason and permitted approval/rejection actions.
- Rejection requires a reason; stale revision conflicts refresh current application
  instead of overwriting a newer decision. No direct MongoDB writes from Laravel.
- Add producer suspension/reinstatement controls with reason and confirmation of
  their actual effect: hidden normal-sale products, blocked new sales, existing
  orders/active auctions continue. Keep these separate from application approval.
- Use typed/validated API boundary conventions established in 038, not stringly
  typed duplicated status constants. Domain decisions remain in NestJS.
- Do not add buyer suspension controls until 042 resolves that policy.

## Acceptance criteria

- [ ] Admin completes approval/rejection/resubmission review using real API results.
- [ ] Producer sees the corresponding current status/reason/notification.
- [ ] Suspension/reinstatement respects prior approval and moderation visibility.
- [ ] Stale actions/API failures preserve meaningful forms and display actual errors.
- [ ] Keyboard, labels and responsive backoffice views are usable.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and manually approve/reject/suspend a producer through the API-backed screens. Verify status feedback and one stale/non-admin refusal.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

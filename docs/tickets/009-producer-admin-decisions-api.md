# 009: Approve or reject producer applications through the API

- Macro: M02, M08
- Status: Draft
- Depends on: 007
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

An authenticated administrator can review applications and approve/reject them,
unlocking real publishing without waiting for the Laravel interface.

## Read first

[Onboarding decisions](../product-decisions.md#accounts-and-producer-onboarding),
[admin decisions](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), and the auth/application modules.

## Scope and contract

- Add an admin guard using current server identity, never a client-selected role.
- `GET /api/admin/producer-applications` provides bounded pagination/status filtering.
  `GET /:id` provides review details. `POST /:id/approve` and `POST /:id/reject`
  atomically require a submitted pending application. Rejection requires a reason.
- Record decision actor/time and a revision for stale decisions. Expose the result
  to the producer through 007. Document 400/401/403/404/409 and public DTOs.
- Provide an explicit local TypeScript admin bootstrap command if needed. It must
  require deliberate credential input, hash passwords, create no public admin
  registration, preserve existing users and avoid logging credentials. Document
  the command; never commit a live admin password or silently promote a buyer.
- No Laravel/React screens, suspension or notifications here. 023 will attach
  persistent notifications to these actual decision services.

## Acceptance criteria

- [ ] Admin can inspect/approve/reject; buyers/producers receive 403.
- [ ] Missing application/reason and stale/already-decided requests are handled.
- [ ] Concurrent opposite decisions cannot overwrite one another silently.
- [ ] Approval immediately changes server eligibility without requiring token expiry.
- [ ] Bootstrap is deliberate and non-destructive; OpenAPI matches the contract.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Approve and reject local applications with real admin requests; try a non-admin request and a stale decision. A dedicated test suite is not required.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

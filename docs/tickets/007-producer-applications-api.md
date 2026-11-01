# 007: Submit and resubmit producer applications

- Macro: M02
- Status: Draft
- Depends on: 003
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

A registered producer supplies their application and can correct a rejection.
Buyers cannot apply to change roles through this flow.

## Read first

[Onboarding decisions](../product-decisions.md#accounts-and-producer-onboarding),
[API guidance](../../apps/api/AGENTS.md), and the user/session modules from 001/003.
Follow [ticket checks and handoff](README.md).

## Scope and contract

- Extend the producer data on the existing user; do not create product/order models.
- Proposed application fields: farm name, description, locality, collection address,
  latitude and longitude. Validate bounded text and geographic coordinate ranges;
  return only approved public profile fields from future public endpoints.
- `GET /api/producer/application` returns the caller's application, current status
  and rejection reason. `PUT` saves/submits a pending application. A rejected
  producer uses `POST /api/producer/application/resubmit` with corrected fields.
- Initial producers remain pending until admin approval. Resubmission atomically
  requires rejected status and returns to pending. Record submission time; reject
  privileged fields and approved/suspended status transitions.
- Extend `/api/auth/me` with the producer status/reason needed by the UI. Keep
  rejection/internal application data out of public producer responses.
- No product drafts, buyer capabilities or admin bypass. Approved public profile
  editing belongs to 010; rejection/approval belongs to 009.

## Acceptance criteria

- [ ] Producers submit and inspect only their own application.
- [ ] Rejected producers correct/resubmit and pending producers see pending status.
- [ ] Buyers, unauthenticated callers and forged approval fields are refused.
- [ ] Resubmission races cannot override a newer administrator decision.
- [ ] Validation, state conflicts and response DTOs are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Submit an application, arrange a rejected fixture, resubmit it and try the action as a buyer. Confirm status/reason remains accurate.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

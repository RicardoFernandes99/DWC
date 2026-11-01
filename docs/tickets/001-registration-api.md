# 001: Register buyer and producer accounts

- Macro: M01
- Status: Draft
- Depends on: None
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond establishing a clean ticket base

## Outcome

A visitor can create a buyer or producer account. Producer accounts start pending
approval and cannot choose or grant administrator access.

## Read first

- [Accounts and onboarding decisions](../product-decisions.md#accounts-and-producer-onboarding).
- [API guidance](../../apps/api/AGENTS.md) and the `api-feature` skill.
- Existing `apps/api/src/app.module.ts`, `apps/api/src/main.ts`,
  `apps/api/src/config.ts` and `apps/api/test/health.test.ts`.

## Scope and contract

- Introduce feature-scoped user schema/module and registration service/controller
  under `apps/api/src/`. Wire the module into the existing app.
- `POST /api/auth/register`: `{ name, email, password, role }`, where public roles
  are `buyer` or `producer`. Respond 201 with a public user DTO, no tokens yet.
- Proposed implementation defaults: trimmed name of 1-100 characters, trimmed
  lowercase email, password of 8-72 UTF-8 bytes, bcrypt cost 12. Never trim or
  silently truncate passwords. Keep these bounds aligned with ticket 004.
- Public user DTO: `{ id, name, email, role, producerStatus }`.
  `producerStatus` is `pending` for new producers and `null` for buyers. Its
  eventual values are `pending`, `approved`, `rejected`, `suspended`; this ticket
  does not expose transitions. Detailed producer applications belong to M02.
- Store a password hash excluded by default from reads, timestamps and a unique
  normalized-email index. Control output through an explicit response DTO.
- Reject unknown fields and privileged input such as `admin`, approval/status
  fields, IDs and hashes. Use 400 for invalid input and 409 for duplicate email,
  including database duplicate-key races. Document these in Swagger.
- Registration does not sign in automatically. Ticket 004 follows successful
  registration with login through ticket 003. No fake session is needed here.

## Acceptance criteria

- [ ] Buyer/producer registrations persist the correct role and initial status.
- [ ] The same email with different casing/outer whitespace cannot register twice.
- [ ] Concurrent duplicate registrations result in one account and a handled 409.
- [ ] Plaintext passwords/hashes never appear in responses or logs.
- [ ] Invalid fields, password bounds and public administrator registration fail.
- [ ] Existing health and storage behavior remains intact; OpenAPI matches DTOs.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Register a buyer and producer, retry the same normalized email, and confirm privileged fields are refused. A small duplicate-registration race check is optional.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

# 001: Register buyer and producer accounts

- Macro: M01
- Status: In review
- Depends on: None
- PR: https://github.com/RicardoFernandes99/DWC/pull/5
- Branch / parent: `codex/age-001-registration-api` / `main` at `3b122e7f21ce82d17d3af7330c830591298a9f4d`
- Blockers: None

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

- [x] Buyer/producer registrations persist the correct role and initial status.
- [x] The same email with different casing/outer whitespace cannot register twice.
- [x] Concurrent duplicate registrations result in one account and a handled 409.
- [x] Plaintext passwords/hashes never appear in responses or logs.
- [x] Invalid fields, password bounds and public administrator registration fail.
- [x] Existing health and storage behavior remains intact; OpenAPI matches DTOs.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Register a buyer and producer, retry the same normalized email, and confirm privileged fields are refused. A small duplicate-registration race check is optional.

## Delivery notes

- Builder: `gpt-6-luna`, high reasoning. Bounded API feature with validation and
  duplicate-write failure cases. No model changes; zero correction rounds.
  Token/credit usage unavailable.
- Frontier verdict: APPROVED. Reviewed the complete ticket diff against parent
  `3b122e7f21ce82d17d3af7330c830591298a9f4d`, including new user feature files.
  Reviewed/check revision: `bf525cdcb3ab129151bfebf13ecd6917cbb6e9ca`.
- Static checks passed: API `typecheck`, `build`, root `lint`, scoped Prettier.
  Existing API tests passed, 4/4. Runtime used Node 24.22.1 and pnpm 11.25.0.
- Real MongoDB/HTTP checks passed: buyer and pending producer persistence,
  trimmed/case-normalized duplicates, simultaneous duplicate requests yielding
  one 201 and one 409 with exactly one record, unknown/privileged fields and admin
  role refused, invalid name/email/password refused, 8/72-byte UTF-8 boundaries
  accepted and 74 bytes refused, password whitespace retained by bcrypt comparison,
  timestamps present, explicit public response and default read hash exclusion.
- Live health/readiness and generated OpenAPI 201/400/409 schemas passed. Source
  and runtime logs contain no credential logging. Only verifier-owned records
  were removed. No new automated test suite was added.
- Registration issues no session or tokens. Login and refresh remain ticket 003.

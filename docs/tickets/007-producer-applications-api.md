# 007: Submit and resubmit producer applications

- Macro: M02
- Status: In review
- Depends on: 003
- PR: https://github.com/RicardoFernandes99/DWC/pull/16
- Branch / parent: `codex/age-007-producer-applications-api` / `main` at `72644054a1bb4a6e7daa461251e5b0d7f5068741`
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

- [x] Producers submit and inspect only their own application.
- [x] Rejected producers correct/resubmit and pending producers see pending status.
- [x] Buyers, unauthenticated callers and forged approval fields are refused.
- [x] Resubmission races cannot override a newer administrator decision.
- [x] Validation, state conflicts and response DTOs are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Submit an application, arrange a rejected fixture, resubmit it and try the action as a buyer. Confirm status/reason remains accurate.

## Delivery notes

- Implemented on `codex/age-007-producer-applications-api`, parent `main` at
  `72644054a1bb4a6e7daa461251e5b0d7f5068741`. PR #16 is ready for review.
- Orchestrator/reviewer: Gemini 4 Argon (Low). Initial implementation subagent:
  Flash (`2fa41024-a2a1-451a-8614-b6d18698343b`, total usage from transcript:
  503,562 input tokens, 2,718,452 cached tokens, 28,238 output/thinking tokens);
  reviewed and refined on Argon (Low) with zero subagent correction rounds.
- Frontier verdict: APPROVED against parent `72644054a1bb4a6e7daa461251e5b0d7f5068741`
  on reviewed implementation commit `78847c452c3dddc75253cef2cdbd398971a40779`.
- Static and contract checks passed with Node 24.22.2 and pnpm 11.25.0:
  `pnpm contract:generate`, `pnpm contract:check`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (10/10 web tests, 4/4 API health tests), `pnpm build` (including
  React Compiler verification), and scoped `prettier --check`.
- Real HTTP and persistence verification on isolated port `3017` against local
  MongoDB replica set and Redis:
  - Unauthenticated calls returned `401`; buyer calls to `GET`, `PUT`, and
    `POST /api/producer/application/resubmit` returned `403`.
  - Unexpected query fields (`GET ?userId=123`), forged privileged fields (`role`,
    `producerStatus`), out-of-range or non-numeric coordinates (`latitude: 95`,
    `longitude: -185`, string coordinates), and whitespace-only text fields
    returned `400`.
  - Initial producer `GET` returned `{ status: 'pending', rejectionReason: null, submittedAt: null, application: null }`
    with `Cache-Control: no-store`.
  - Valid `PUT /api/producer/application` trimmed text fields, persisted embedded
    `producerApplication` on `User`, and recorded `submittedAt`.
  - Simulated administrator rejection in MongoDB surfaced `producerStatus: 'rejected'`
    and `producerRejectionReason` on both `/api/auth/me` and
    `GET /api/producer/application`, while `PUT` returned `409 Conflict`.
  - `POST /api/producer/application/resubmit` atomically required `rejected`
    status, transitioned back to `pending`, cleared `producerRejectionReason`,
    and updated `submittedAt`.
  - Duplicate `POST /resubmit` while `pending` and `PUT` / `POST /resubmit` after
    simulated administrator approval returned `409 Conflict` without overwriting
    the newer decision.
  - All temporary test users and Redis session keys were removed after verification.
- Limitations: Administrator approval/rejection endpoints belong to ticket 009;
  producer onboarding UI screens belong to ticket 008; public producer profile
  endpoints and approved profile editing belong to tickets 010 and 013.

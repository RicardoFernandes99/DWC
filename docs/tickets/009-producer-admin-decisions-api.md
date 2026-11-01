# 009: Approve or reject producer applications through the API

- Macro: M02, M08
- Status: In progress
- Depends on: 007
- PR: Not opened
- Branch / parent: `codex/age-009-producer-admin-decisions-api` / `codex/age-008-producer-onboarding-web` at `9ffb71172b282e8e64d73560eb53161c9e8b10a7`
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

- [x] Admin can inspect/approve/reject; buyers/producers receive 403.
- [x] Missing application/reason and stale/already-decided requests are handled.
- [x] Concurrent opposite decisions cannot overwrite one another silently.
- [x] Approval immediately changes server eligibility without requiring token expiry.
- [x] Bootstrap is deliberate and non-destructive; OpenAPI matches the contract.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Approve and reject local applications with real admin requests; try a non-admin request and a stale decision. A dedicated test suite is not required.

## Delivery notes

- Implemented on `codex/age-009-producer-admin-decisions-api`, stacked on PR #17 (`codex/age-008-producer-onboarding-web` at `9ffb71172b282e8e64d73560eb53161c9e8b10a7`).
- Orchestrator/reviewer: Gemini 4 Argon (Low). Builder subagent: `self` (`Model: 'inherit'` — Gemini 4 Argon Low, `0f3687b4-9120-4728-ab4f-6d72c1e0229a`, transcript usage: 245,590 input tokens, 2,856,345 cached tokens, 33,514 output/thinking tokens), with zero subagent correction rounds.
- Frontier verdict: APPROVED against parent `9ffb71172b282e8e64d73560eb53161c9e8b10a7`.
- Static and contract checks passed with Node 24.22.2 and pnpm 11.25.0:
  - `pnpm contract:generate` and `pnpm contract:check`
  - `pnpm typecheck` (`tsconfig.tools.json`, `@dwc/api`, `@dwc/web`)
  - `pnpm lint` (`eslint . --max-warnings 0`)
  - `pnpm test` (`@dwc/web`: 15/15 tests across 4 files; `@dwc/api`: 4/4 tests)
  - `pnpm build` (`@dwc/api` NestJS build and `@dwc/web` Vite + React Compiler build)
  - Scoped `prettier --check` on all 17 touched files
- Real HTTP, MongoDB replica-set and Redis verification on isolated port `3019`:
  - `pnpm --filter @dwc/api admin:bootstrap` rejected a short password (`exit code 1`) without echoing the secret, refused to overwrite or promote an existing buyer account (`exit code 1`), and created a new administrator account (`role: 'admin'`) hashed with bcrypt (`cost = 12`).
  - Public `POST /api/auth/register` with `role: 'admin'` returned `400 Bad Request`.
  - Unauthenticated calls to `/api/admin/producer-applications` returned `401 Unauthorized`; buyer and producer calls to `GET /`, `GET /:id`, `POST /:id/approve`, and `POST /:id/reject` returned `403 Forbidden`.
  - Unsubmitted producer accounts were excluded from `GET /api/admin/producer-applications`, returned `404` on `GET /:id`, and returned `409 Conflict` on `POST /:id/approve` / `POST /:id/reject`.
  - Submitted pending application appeared in `GET /api/admin/producer-applications` and `GET /:id` with `status: 'pending'` and `revision: 1`.
  - `POST /:id/reject` without `reason` or with a whitespace-only `reason` returned `400 Bad Request`.
  - Simultaneous `POST /:id/approve` and `POST /:id/reject` requests at `revision: 1` resolved atomically with one `200 OK` (`revision: 2`) and one `409 Conflict`.
  - Full reject (`revision: 2`) -> stale approve (`409 Conflict`) -> producer sees `producerStatus: 'rejected'`, `rejectionReason`, and `decidedAt` on `/api/auth/me` and `/api/producer/application` -> producer resubmits (`POST /api/producer/application/resubmit`, `revision: 3`) -> stale approve with `revision: 2` (`409 Conflict`) -> admin approves with `revision: 3` (`200 OK`, `status: 'approved'`, `revision: 4`) -> producer immediately sees `producerStatus: 'approved'` on `/api/auth/me` and `/api/producer/application` using the existing access token without waiting for token expiry.
  - All temporary verification users and Redis session keys were removed after verification (`0` residual records).
- Limitations: Persistent inbox and live Socket.io notifications for producer approval/rejection decisions belong to Tickets 023 and 024; producer suspension endpoints belong to Ticket 035; Laravel backoffice review screens belong to Tickets 038 and 039.

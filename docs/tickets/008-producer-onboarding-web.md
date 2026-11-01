# 008: Show producer approval and resubmission screens

- Macro: M02
- Status: In progress
- Depends on: 004, 007
- PR: Not opened
- Branch / parent: `codex/age-008-producer-onboarding-web` / `codex/age-007-producer-applications-api` at `6943fc53c6ca042f379dce4e3f729c9ad969feb5`
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

- [x] Initial application, pending, rejected and suspended states are distinct.
- [x] Rejected producers can correct/resubmit; rejected API writes show real errors.
- [x] Pending users cannot reach creation forms through direct URLs as routes arrive.
- [x] Buyer/guest navigation does not expose producer application data.
- [x] Labels, keyboard/focus behavior and all three responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Check pending, rejected/resubmission and suspension views in a browser, including a failed submit and responsive/keyboard behavior.

## Delivery notes

- Implemented on `codex/age-008-producer-onboarding-web`, stacked on PR #16 (`codex/age-007-producer-applications-api` at `6943fc53c6ca042f379dce4e3f729c9ad969feb5`).
- Orchestrator/reviewer: Gemini 4 Argon (Low). Builder subagent: `self` (`Model: 'inherit'` — Gemini 4 Argon Low, `c17cba56-d5ad-4541-8750-a4e18649e7bd`, transcript usage: 188,816 input tokens, 3,515,185 cached tokens, 18,716 output/thinking tokens), with zero subagent correction rounds and inline polish during frontier review.
- Frontier verdict: APPROVED against parent `6943fc53c6ca042f379dce4e3f729c9ad969feb5`.
- Static, compiler and contract checks passed with Node 24.22.2 and pnpm 11.25.0:
  - `pnpm --filter @dwc/web typecheck` (`tsc --noEmit`)
  - `pnpm --filter @dwc/web test` (15/15 tests across 4 files, including 5 new tests in `apps/web/src/producer-onboarding.test.tsx`)
  - `pnpm --filter @dwc/web build` (including React Compiler output verification)
  - `pnpm lint` (`eslint . --max-warnings 0`)
  - `pnpm contract:check`
  - `pnpm prettier --check apps/web/src`
- Real Chrome/Playwright verification on isolated Vite (`5174`) and API (`3018`) servers against local MongoDB and Redis:
  - Registered a producer account and confirmed redirect to `/producer` in the initial pending state (`status: 'pending'`, `application: null`) with `"Pending approval"` badge/card, verification checklist, and no selling/creation tools.
  - Verified client-side validation failure (out-of-range latitude `115`) preserved all entered form values, associated error feedback via `aria-describedby` / `aria-invalid`, and moved keyboard focus to `#producer-latitude`.
  - Submitted the pending application (`PUT /api/producer/application`), confirmed `"Application submitted for administrator review."` status feedback, single `submittedAt` timestamp, tabular coordinate rendering (`38.8029, -9.3817`), and transition to `"Update pending application"`.
  - Navigated directly to `/producer/products/new` while pending and verified that the `/producer/$` splat route blocked creation tools and displayed the pending status notice for `/producer/products/new`.
  - Simulated an administrator rejection in MongoDB while the pending form was open, triggered a stale `PUT` (`409 Conflict`), and verified that the UI never inferred approval locally, immediately refetched `/api/auth/me` and `/api/producer/application`, and transitioned to `"Application rejected"` with the rejection reason and pre-populated `"Correct and resubmit application"` form.
  - Resubmitted corrected details via `POST /api/producer/application/resubmit` and verified transition back to `"Pending approval"`.
  - Simulated administrator suspension in MongoDB, reloaded `/producer`, and verified the exact agreed banner (`"Your account is suspended until the issue is resolved. You cannot create new auctions or register new products."`), existing-order fulfilment notice, and absence of creation/application forms.
  - Signed out, registered a buyer account, navigated directly to `/producer`, and verified zero requests to `/api/producer/application` and no exposure of producer onboarding UI.
  - Checked responsive layout and zero horizontal overflow (`scrollWidth <= clientWidth`) at `375px`, `767px`, `768px`, `900px`, `1279px`, `1280px`, and `1440px`; screenshots saved locally under `demos/ticket-008-*.png` (untracked). Temporary test accounts and sessions were removed after verification.
- Limitations: Live Socket.io notification-driven status refresh belongs to Ticket 024; administrator approval/rejection API belongs to Ticket 009; approved producer product, order, and auction workspaces belong to Tickets 012, 021, and 029.

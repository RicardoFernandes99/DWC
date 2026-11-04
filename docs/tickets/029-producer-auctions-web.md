# 029: Create and manage producer auction lots

- Macro: M05
- Status: In review
- Depends on: 012, 026
- PR: https://github.com/RicardoFernandes99/DWC/pull/43
- Branch / parent: `codex/age-029-producer-auctions` on `codex/age-028-auction-settlement` (PR #42)
- Blockers: None beyond dependencies

## Outcome

Approved producers select a product/lot, schedule an auction and manage it before
start with clear reserved-stock and eligibility feedback.

## Read first

[Auctions](../product-decisions.md#auctions),
[web guidance](../../apps/web/AGENTS.md), product UI and API 026.

## Scope and contract

- Add producer auction list/create/detail/edit screens with product selection,
  fixed lot quantity, starting price, increment and start/end inputs.
- Explain that bid price is for the whole lot and quantity is reserved from normal
  stock. Use product units/precision and authoritative available/reserved amounts.
- Convert displayed local dates deliberately to API timestamps; server decides
  whether creation/edit/cancel is timely. Handle stale stock/time 409 responses.
- Enable edits/cancel only pre-start; show locked active terms and explicit
  cancellation confirmation. Refresh product stock after successful reservation.
- Pending/rejected users see approval status; suspended producers see the agreed
  banner, existing records and permitted navigation without new-auction controls.
- Link public room when available; live history/winner display is completed in 030.

## Acceptance criteria

- [x] Real create/edit/cancel updates both auction and available-stock UI correctly.
- [x] Whole-lot price, dates, increments and quantity validation match the API.
- [x] Refused late/stale changes show current server state without false success.
- [x] Suspension/pending state cannot be bypassed through direct form URLs.
- [x] Forms, confirmations and lists work with keyboard and all screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Create/reschedule/cancel a lot, try a late or stale edit and inspect stock feedback. Check dates, form labels and responsive layout.

## Delivery notes

Implemented producer auction list, create, detail and pre-start edit/cancel routes.
The paginated list includes existing records; product selection loads catalogue
pages and editing reads the selected product directly. Mutation results refresh
auction and product stock queries. Integer lot/cents validation, local date
conversion, explicit cancellation, stale revision/stock recovery, cached-form
retention and truthful paused/offline states use the existing API contract.
Pending/rejected producers see approval feedback. Suspended producers retain
read access and the API-permitted pre-start cancellation, without create/edit
controls. Active terms are locked. Public room links await the route in 030.

- Parent SHA: `ff9ce2069324697895892553b99a6851a4f5287c`.
- Reviewed implementation: `07401be4e6f2182379a8e05ada3097e2550eb698`.
- Executor: `gpt-6-luna`, High effort. Frontier verdict: APPROVED after one
  formal correction round. That round clarified paused mutation feedback and
  added a route-level form heading. Usage/cost measurements were unavailable.
- Passed: `pnpm --filter @dwc/web typecheck`, root `pnpm lint`, scoped Prettier,
  `pnpm --filter @dwc/web build` with React Compiler verification, and Git diff
  checks. Existing Vite bundle-size advisory remains. No full automated suite
  or API build was required/run for this UI-only change.
- Independent real Chrome/Mongo/API review passed authenticated
  create/edit/reschedule/cancel, exact cents/local timestamps, stale revision 409
  retention/reload, offline queued-save retention and successful reconnection,
  competing real reservation/stock 409 recovery, stock release, active/direct edit
  locks, direct create/edit guards for pending/rejected/suspended producers,
  keyboard Tab/Enter and no horizontal overflow at 390, 900 and 1440 pixels.
- Local untracked evidence: `demos/ticket-029-review/review-browser.ts` and 42
  screenshots covering empty/populated lists, create/edit/detail, revision/stock
  conflicts, offline save, cancellation, active lock and approval restrictions.
  Fixture records were removed. Initial fixture navigation used an origin that
  differed from configured localhost; correcting the fixture resolved it.
- Existing dirty build-skill, ticket-index, order UI and shared CSS work was
  excluded and verified byte-identical across all eight preserved files.
- Published through native `gh stack` in stack #34. The first push met a GitHub
  internal server error; the native retry succeeded. No merge was performed.

### Visual polish follow-up

A later review with the frontend skill set (`interface-design`, Impeccable
polish, Emil interaction guidance) found and fixed: the empty state now gives
its copy the full width with a single right-aligned action on tablet/desktop
(stacked on mobile) and no duplicate header action; validation errors are
per-field, associated through `aria-describedby` and focus the first invalid
field; a queued offline save locks the editable fields while keeping values and
connection status visible. The field lock keeps normal group spacing.

- Orchestrated by Codex, finished by Claude Opus 5.5 (frontier) after handover;
  the fieldset spacing fix was a one-line frontier change.
- Passed: API and web typecheck, `pnpm contract:check`, root lint, web build
  with React Compiler verification, scoped Prettier. Bundle-size advisory remains.
- Real Chrome/Mongo/API rerun (`demos/ticket-030-review/review-producer-after.ts`)
  passed all earlier flows plus error focus/ARIA and queued-save field locking.
  Before images: `demos/ticket-029-review/before-polish/`; after images:
  `demos/ticket-029-review/after/` at 390, 900 and 1440 pixels.

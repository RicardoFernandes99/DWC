# 042: Define and implement buyer suspension behavior

- Macro: M08
- Status: In review
- Depends on: 027, 028, 039
- PR: https://github.com/RicardoFernandes99/DWC/pull/56
- Branch / parent: `codex/age-042-buyer-suspension` / `codex/age-041-laravel-inspection-health` (PR 55)
- Blockers: None. User confirmed the policy choices on 2026-11-05.

## Outcome

The agreed admin user-suspension capability extends to buyers with explicit rules
for existing commitments rather than inheriting producer restrictions accidentally.

## Read first

[Open decisions](../product-decisions.md#open-decisions),
[suspension](../product-decisions.md#laravel-administration-and-suspension),
session/bid/settlement APIs and backoffice guidance from 038.

## Scope and contract

- Resolve the named policy questions with the user and record them in product
  decisions before writing guards/transitions. Existing accepted bids and paid
  orders cannot be silently abandoned by an invented blanket account lockout.
- Then add narrow admin buyer suspend/reinstate actions and Laravel controls with
  current-state authorization, reason/actor/time and stale-update protection.
- Apply the agreed behavior consistently across HTTP, Socket.io/private dispatch,
  checkout/bidding, refunds and settlement. Account banner/copy must reflect the
  chosen permissions rather than reusing producer-only text.
- Keep producer suspension unchanged. Do not broaden into ban appeals or automatic
  fraud detection. Split implementation further if the resolved policy requires it.

## Acceptance criteria

- [x] Every listed policy question has an explicit recorded answer before building.
- [x] Admin-only transitions and current-session enforcement match those answers.
- [x] Existing orders/bids/settlement are handled consistently under suspension races.
- [x] Buyer UI and admin controls reflect the real permissions and reasons.
- [x] Reinstatement restores only the intended capabilities.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Once policy is agreed, use affected static checks and a short manual HTTP/socket/browser flow for suspension and existing commitments. Add a small regression check only if useful.

## Delivery notes

Policy resolved with the user before implementation and recorded in
`docs/product-decisions.md`. Sign-in, reads, existing commitments/refunds,
ordinary account actions and live notifications remain available. New purchases
and bids are blocked; reinstatement restores them immediately without replay.

Verified parent: PR 55 at `cef6cba235d800748dd308d0ee3bf3140581f0af`.
Executor: `gpt-6-luna`, High effort for transaction, session/socket and mixed-UI scope.
Correction rounds: 2. Usage/cost measurements unavailable.

Frontier verdict: APPROVED on 2026-11-05 after actual diff, transaction and visual
review. Buyer standing lives in `users/buyer-standing.*` and remains independent
of producer standing. Admin POST `/api/admin/buyers/:id/suspend` accepts
`{ revision, reason }`; `/reinstate` accepts `{ revision }`. Legacy buyers begin
active at decision revision zero. Transitions persist decision actor/time and one
inbox notification in the same transaction. Reinstatement retains the last
suspension reason for admin inspection, while `/auth/me` exposes a reason only
during suspension. Checkout and bid acceptance share a real buyer-document write
with suspension, inside their respective MongoDB transactions.

Reviewed implementation revision: `0d703dab4b26e2bc339825e57dadd0936fec76dc`.
Published ready for review as PR 56 through native `gh stack` stack 34, targeting
PR 55's branch. No merge performed. Final metadata-only update follows this
reviewed implementation; check final-head CI on the PR.

API/web typecheck and build, tools strict TypeScript, root ESLint with the
pre-existing untracked `demos/ticket-040-review/review.ts` excluded, scoped
Prettier, generated OpenAPI drift checks, Laravel platform requirements, Pint,
Larastan and Blade view caching passed. Vite retains its existing chunk warning.

Manual evidence: `demos/ticket-042-review/result.txt` records 12 passing groups
through real HTTP, Socket.IO, Laravel forms and production web preview. Checks
cover legacy accounts, admin-only and stale decisions, bounded reasons, missing
CSRF, current-session notifications, escaped angle-bracket reasons, accepted
request retries, refunds, settlement exactly once while suspended, retained cart,
reinstatement and real database contention against simultaneous checkout/bidding.
Forwarding-proxy fault injection verified zero mutation dispatch during an admin
gate outage and exactly one dispatch when a post-commit response was malformed.
All uniquely owned fixtures and known session keys/files were removed; the
temporary Laravel config cache and proxy were cleared.

Actual browser screenshots cover 390, 768, 900 and 1440 pixels, including active,
suspended, reinstated, validation, gate-unavailable and unknown-result states.
The app-screen inspector reports zero failures across the representative admin,
buyer, checkout, auction and recovery views. Explicit `heavy-shadow` allowances
retain the existing floating toast and selected-payment control ring. Orchard's
cream palette/context labels and existing heading/layout conventions remain.
All generated inspector renders were reviewed through local contact sheets.

Optional legacy test limitations: web Vitest reports 20 passed and 9 failed due
to existing router-context setup. The parent Account page and its original tests
reproduce that failure. API test-project TypeScript now reports only the inherited
`test/product-images.test.ts:265` three-versus-four constructor argument mismatch.
New user-fixture/model-type incompatibilities introduced here were corrected.
These optional suites are not claimed to pass; required CI checks do not run them.

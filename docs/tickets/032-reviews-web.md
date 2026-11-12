# 032: Display producer reviews and collect completed-order feedback

- Macro: M06
- Status: In review
- Depends on: 014, 021, 031
- PR: https://github.com/RicardoFernandes99/DWC/pull/46
- Branch / parent: `codex/age-032-reviews-web` / PR #45 `codex/age-031-reviews-api` at `3aac723` (native stack #34)
- Blockers: None beyond dependencies

## Outcome

Visitors read real producer ratings/reviews; buyers review eligible orders and
signed-in users can report content.

## Read first

[Reviews](../product-decisions.md#notifications-and-reviews),
[web guidance](../../apps/web/AGENTS.md), producer/order UI and API 031.

## Scope and contract

- Add public producer rating summary and paginated reviews with empty/loading/error
  states; no invented ratings for producers without visible reviews.
- Completed buyer-order detail exposes a 1-5 star/optional-comment form when no
  review exists. Server eligibility/conflict is authoritative after submission.
- Use accessible radio/button semantics for stars, textual labels and visible
  focus. Do not rely on color/hover to communicate selection.
- Add authenticated report reason action with pending/success/error feedback.
  Display comments as text; do not inject stored HTML.
- Refresh public review/rating queries after accepted feedback. A hidden review
  disappears on refresh; do not expose moderation reports on public pages.
- No producer response, review editing or moderation UI outside the Laravel tickets.

## Acceptance criteria

- [x] Both delivered and collected orders offer one valid review flow.
- [x] Duplicate/foreign/ineligible API refusals show useful errors, not fake success.
- [x] Public rating/count agrees with visible reviews and handles no reviews.
- [x] Report action requires sign-in and handles duplicate submissions.
- [x] Stars, comments and pagination work by keyboard at all responsive ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Read/create/report a review in a browser and try a duplicate submission. Check accessible stars, plain-text comments and responsive layout.

## Delivery notes

- Orchestrator/reviewer: Claude Opus 5.5. Builder: Claude Sonnet (Agent tool), one handoff plus 1 correction round (fixture realism; report form width). Usage measurements unavailable.
- User decision: the outstanding uncommitted orders-screen redesign found in the checkout was evaluated (typecheck/lint pass, behaviour preserved, token-only feature CSS) and committed separately as `b982ff8` on this branch, per the user's instruction to commit it if it belonged to the project.
- Frontend skills: `web-feature`, `design-engineering`, `interface-design`, `emil-design-eng`.
- Implementation: `features/reviews/` (queries, star display/input, producer reviews, report action, order review panel); minimal mounts in `catalogue.tsx` (header summary + Reviews section) and `order-detail.tsx` (buyer, delivered/collected).
- Frontier verdict: APPROVED on the working tree implementation commit `5ea6f43` (parent `3aac723`, PR #45).
- Checks: web typecheck, root lint (0 warnings), web build with React Compiler check, scoped Prettier, `git diff --check`: pass. `pnpm --filter @dwc/web test`: 7 failures in `app.test.tsx`/`producer-onboarding.test.tsx` (`isServer` of null), identical on parent `3aac723`, so pre-existing and unrelated.
- Browser: `demos/ticket-032-review/seed.ts` + `review-browser.ts` (Playwright, Chrome) against the built API on 3131 and Vite on 5174; 16 states at 390/900/1440, no page errors or horizontal overflow. Covers summary/list/pagination by keyboard, empty and error states, hidden review excluded, literal HTML in comments, signed-out report prompt, report required category, error retention, idempotent repeat and 404, delivered and collected review forms, arrow-key star selection, success refreshing the public list, a stale-tab duplicate showing 409 `review_exists`, and API error retention. Frontier re-checked pagination, count agreement and the signed-out report link in the Claude browser. Screenshots stay local under `demos/ticket-032-review/` (untracked).
- Limitations: the seed adds `ticket032-` tagged records to local Mongo and does not clean them up; re-seed before re-running the browser script. The header summary shares the page-1 query, so it updates after invalidation/refetch.

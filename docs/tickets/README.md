# Build tickets

Numbered tickets implement the [feature roadmap](../feature-roadmap.md).
[Product decisions](../product-decisions.md) are authoritative for behavior.
Tickets 001-045 cover the currently agreed macro features, UI foundation and demo setup.
More tickets can be added later without renumbering these. Unresolved product
choices are explicit blockers on the affected drafts, not permission to guess.

## Starting a build in a new chat

Merge the setup PR containing these tickets and the `build` skill into `main`
before starting ticket 001. Use a clean checkout with Node 24 from `.node-version`
and the pinned pnpm. Install with `pnpm install --frozen-lockfile`; run
`pnpm setup:local` and `pnpm infra:up` for the local services.

Start a fresh Codex chat in this repository, select Sol Medium and send
`build 1` or `$build 1`. The skill reads ticket 001, chooses its builder and
ends with a reviewed PR. It does not require the earlier chat history. Keep the
authenticated GitHub CLI (`gh`) available for PR discovery/publication. GitHub
operations use `gh` rather than the ChatGPT Codex Connector, by user preference.
Later UI work requires ticket 045 before 004; unresolved product decisions are
still blocked where listed below.

## First batch: accounts and authentication

| Build | Ticket                                                          | Requires                    |
| ----- | --------------------------------------------------------------- | --------------------------- |
| 1     | [Registration API and user model](001-registration-api.md)      | None                        |
| 2     | [Redis API integration and readiness](002-redis-integration.md) | Redis Compose configuration |
| 3     | [Login, refresh and logout sessions](003-auth-sessions-api.md)  | 001, 002                    |
| 4     | [Registration, login and session-aware UI](004-auth-web.md)     | 003, 045                    |
| 5     | [Saved payment methods API](005-payment-methods-api.md)         | 003                         |
| 6     | [Saved payment methods UI](006-payment-methods-web.md)          | 004, 005                    |

## Shared UI foundation

| Build | Ticket                                                            | Requires         |
| ----- | ----------------------------------------------------------------- | ---------------- |
| 45    | [UI tokens, primitives and visual specimen](045-ui-foundation.md) | None; before 004 |

045 was added after the domain drafts. Build it before auth/feature screens;
ticket dependencies make this explicit. It is not a smoke/e2e ticket.

## Producer onboarding

| Build | Ticket                                                              | Requires |
| ----- | ------------------------------------------------------------------- | -------- |
| 7     | [Producer applications API](007-producer-applications-api.md)       | 003      |
| 8     | [Producer onboarding screens](008-producer-onboarding-web.md)       | 004, 007 |
| 9     | [Admin approval/rejection API](009-producer-admin-decisions-api.md) | 007      |

## Catalogue and products

| Build | Ticket                                                           | Requires                     |
| ----- | ---------------------------------------------------------------- | ---------------------------- |
| 10    | [Products, profile and stock API](010-products-profile-api.md)   | 009; product-value decisions |
| 11    | [Product images API](011-product-images-api.md)                  | 010                          |
| 12    | [Producer product/profile screens](012-producer-products-web.md) | 008, 010, 011                |
| 13    | [Public catalogue API](013-public-catalogue-api.md)              | 010, 011                     |
| 14    | [Catalogue and producer pages](014-public-catalogue-web.md)      | 004, 013                     |
| 15    | [Persistent guest cart](015-guest-cart-web.md)                   | 014                          |

## Checkout and orders

| Build | Ticket                                                       | Requires           |
| ----- | ------------------------------------------------------------ | ------------------ |
| 16    | [Checkout quote and fees](016-checkout-quote-api.md)         | 003, 010, 013      |
| 17    | [Atomic checkout/payment/orders](017-atomic-checkout-api.md) | 005, 016           |
| 18    | [Checkout screens](018-checkout-web.md)                      | 006, 015, 016, 017 |
| 19    | [Sequential order tracking API](019-order-tracking-api.md)   | 017                |
| 20    | [Pending refund/cancellation API](020-refunds-api.md)        | 019                |
| 21    | [Order tracking/refund screens](021-order-tracking-web.md)   | 008, 018, 019, 020 |

## Notifications

| Build | Ticket                                                                         | Requires                |
| ----- | ------------------------------------------------------------------------------ | ----------------------- |
| 22    | [Socket.io sessions and private rooms](022-socketio-transport.md)              | 003                     |
| 23    | [Persistent inbox API](023-inbox-api.md)                                       | 003                     |
| 24    | [Order/approval notification integration](024-order-approval-notifications.md) | 009, 019, 020, 022, 023 |
| 25    | [Inbox and live toasts](025-notifications-web.md)                              | 004, 021, 024           |

## Auctions

| Build | Ticket                                                           | Requires                                          |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 26    | [Auction scheduling/reservations](026-auction-scheduling-api.md) | 010, 019; scheduled suspension policy             |
| 27    | [Atomic bids and live state](027-atomic-bids-api.md)             | 005, 022, 026                                     |
| 28    | [Winner settlement](028-auction-settlement-api.md)               | 017, 019, 023, 024, 027; payment edge-case policy |
| 29    | [Producer auction screens](029-producer-auctions-web.md)         | 012, 026                                          |
| 30    | [Public live auction screens](030-live-auction-web.md)           | 006, 014, 025, 027, 028, 029                      |

## Reviews and producer dashboard

| Build | Ticket                                              | Requires                          |
| ----- | --------------------------------------------------- | --------------------------------- |
| 31    | [Reviews and reports API](031-reviews-api.md)       | 019, 028                          |
| 32    | [Producer review screens](032-reviews-web.md)       | 014, 021, 031                     |
| 33    | [Producer metrics API](033-producer-metrics-api.md) | 010, 020, 028; metric definitions |
| 34    | [Producer dashboard](034-producer-dashboard-web.md) | 012, 021, 033                     |

## Administration

| Build | Ticket                                                              | Requires                               |
| ----- | ------------------------------------------------------------------- | -------------------------------------- |
| 35    | [Producer suspension API](035-producer-suspension-api.md)           | 009, 013, 019, 026                     |
| 36    | [Content moderation API](036-content-moderation-api.md)             | 009, 013, 031                          |
| 37    | [Admin inspection/health API](037-admin-inspection-api.md)          | 002, 009, 019, 028                     |
| 38    | [Laravel authentication foundation](038-laravel-auth-foundation.md) | 003, 009; PHP/tooling/auth choices     |
| 39    | [Laravel producer decisions](039-laravel-producer-decisions.md)     | 035, 038                               |
| 40    | [Laravel content moderation](040-laravel-content-moderation.md)     | 036, 038                               |
| 41    | [Laravel inspection and health](041-laravel-inspection-health.md)   | 037, 038                               |
| 42    | [Buyer suspension](042-buyer-suspension.md)                         | 027, 028, 039; buyer suspension policy |

## Invoices and demo setup

| Build | Ticket                                                      | Requires                        |
| ----- | ----------------------------------------------------------- | ------------------------------- |
| 43    | [Invoice output](043-invoice-output.md)                     | 017, 020, 028; document choices |
| 44    | [Non-destructive demo fixtures](044-local-demo-fixtures.md) | 020, 028, 031, 035, 036         |

All tickets are drafts for implementation review or explicitly Blocked. Their Status, PR and Blockers
fields are maintained in the ticket itself. An unmet dependency prevents building
even when the ticket is otherwise well specified. Numbers are stable identifiers,
not macro IDs and not promises that unrelated dependencies already exist.

Blocked decision tickets cover product values/precision (010), elapsed scheduled
auctions during suspension (026), payment settlement edge cases (028), metric
definitions (033), Laravel setup/auth (038), buyer suspension (042) and invoice
output (043). Account recovery is still an open scope question rather than an
assumed password-reset feature. Do not invent it while building auth.

## Shared implementation standards

These apply to every ticket, including 001-006, and belong in builder handoffs:

- Keep strict TypeScript and existing compiler diagnostics enabled. Validate
  untrusted HTTP/socket/storage data as `unknown` at boundaries, then narrow it.
  Do not hide errors with `any`, double assertions, non-null assertions without
  proof, `@ts-ignore`, broad lint disables or handwritten false response types.
- UI work follows [the shared style reference](../ui-guidelines.md) and the 045
  visual specimen. Consume central CSS tokens, organize library primitives under
  `components/ui` and extract repeated project patterns into typed components.
- Nest DTOs/OpenAPI own HTTP contracts. At the first Web API client in 004,
  introduce reproducible OpenAPI-derived request/response types and typed endpoint
  calls, with a generation/drift check in the appropriate checks. Update them with
  later API changes. Avoid handwritten duplicate interfaces that drift independently.
  Generated types do not replace runtime DTO validation or authorization.
- Define typed Socket.io event maps and acknowledgement payloads when 022/027
  introduce events. When 025/030 consume them, use one shared contract source
  with actual API/Web consumers. A small shared package is justified then, not
  before consumers exist. Runtime input validation remains mandatory.
- Use explicit role, approval, order, refund and auction state unions/enums with
  exhaustive handling. Keep distinct state machines separate. Money uses integer
  cents; quantities follow the agreed precision and timestamps have clear meaning.
- Typecheck all changed consumers, not just the server. An intentional contract
  change must update generated/shared types, call sites and relevant tests in the
  same ticket. Include type generation, typecheck and build results in delivery evidence.
- Laravel PHP gets the static-analysis and validated API-boundary conventions
  selected in 038; TypeScript diagnostics cannot check PHP automatically.
- Do not add new lint rules or a type-aware lint preset incidentally. Current ESLint
  uses TypeScript recommended rules; both apps already use strict TypeScript.
  Potential additions to discuss are type-aware unsafe-value checks, floating/
  misused promise checks and switch exhaustiveness. Confirm configuration, scope
  and adoption cost with the user before a separate tooling change.

## Lightweight verification

This is a university project. Default to affected-app typecheck/build, root lint
and scoped formatting checks, plus a short manual API/browser check of the changed
flow and one meaningful refusal. Record what was actually checked. Shared contract
changes also typecheck their consumers and run the generation/drift check.

Do not create a smoke/e2e suite or require unit tests for each feature. Automated
tests are optional and justified only where a small test helps catch a meaningful
regression, such as stock/bid concurrency or refund duplication. A focused pair
of real requests or two browser windows can be enough to exercise those cases.
Do not describe a manual check as proof of every possible interleaving.

Existing tests and `pnpm smoke` remain available for debugging or a change that
actually affects them; they are not mandatory gates for every ticket. Preserve
existing tests rather than deleting them to hide a failure. Laravel uses the
chosen formatter/static analysis plus short manual checks; no new PHP test suite
is required merely because it is a separate application.

## Sol and builder handoff

The [build skill](../../.agents/skills/build/SKILL.md) is the executable agent
workflow for this handoff. Sol Medium is the orchestration/review baseline.
Implementation uses Luna Medium for straightforward work, Luna High for bounded
features with several failure cases, and Terra Medium for UI/browser work and
scoped fixes being evaluated. Difficult correctness work stays with Sol Medium
or is split into smaller builder tasks. The skill owns the exact model selection
and adaptation rules; builders receive fresh, compact context. User choices take
precedence. No parallel editing agents or guaranteed token savings are implied.

Sol:

1. Read the requested ticket and check dependencies against actual code and PRs.
   Read only relevant product-decision sections and app guidance. Resolve contract
   conflicts before delegation; do not ask the builder to invent product rules.
2. Preserve local changes and establish a usable ticket base without silently
   including unrelated edits in its PR. Use the existing checkout, not a new worktree.
3. Reuse an existing branch/PR for this ticket when resuming. For new work,
   discover the latest open feature PR and branch from its current tip, even if
   this ticket is unrelated. With no open feature PR, use current `main`.
   Identify open PRs from GitHub, not a remembered PR number. Use `codex/` branches.
   Never stack the ticket on its own PR or include maintenance PRs by accident.
4. Give the builder the ticket path, verified base/branch, relevant starting
   files, current dependency contracts, allowed scope and runnable checks.
   Prefer targeted reads and concise results over sending the full chat/PDF.
5. Review the actual diff and the highest-risk acceptance cases. Run checks the
   builder could not run, or explicitly report limitations. Reuse valid evidence
   for the unchanged revision; do not rerun everything simply to repeat it.
   Give APPROVED or CHANGES REQUESTED; send concrete corrections back to the
   builder. Required checks and acceptance evidence must pass before approval.
   Stop after three unsuccessful correction rounds and report the blocker.
   Record selected models/efforts, correction count and any justified adaptation.
   Record token/credit usage only if exposed by the client; do not invent it.
6. Commit only this ticket's work, push and open a ready-for-review PR against
   its parent branch. Confirm the diff contains only this ticket. Record the PR
   URL, branch, parent and actual check results in the ticket. Leave merging to
   the user. Merging is bottom-up; reconcile remaining bases when parents merge.
   Use `Age N - <short feature summary>` as the PR title, with N the ticket ID.

Builder:

- Implement only the assigned ticket. Read the owning app instructions and
  relevant implementation skills, then the listed starting points. File names
  proposed for new modules are suggestions, not claims that files already exist.
- Keep schemas and indexes with their first feature. Do not scaffold future
  products, orders, auctions or a generic repository/payment framework.
- Bring missing decisions or incompatible dependency contracts back to Sol.
  Report a concrete blocker rather than silently broadening the task.
- Return a short summary, changed files, exact checks and results, limitations
  and any contract changes. No separate plan/state files or long execution log.
- Sol owns GitHub writes and stack maintenance; the builder need not rediscover
  the repository, post reviews, open competing PRs or merge anything.

`build N` names ticket N in this directory; plain `build` chooses the next eligible
unfinished ticket. The skill runs one ticket per invocation, ending at an approved
ready-for-review PR. It is a model-driven workflow, not `pnpm build`.

## Ticket conventions

Use [the template](TEMPLATE.md) for future tickets. Keep each ticket independently
understandable with explicit API/UI boundaries, observable acceptance criteria
and meaningful failures. Link authoritative rules instead of repeating the full
scope. Label proposed implementation defaults and unresolved product decisions.

Keep statuses factual: Draft, Ready, In progress, In review, Blocked or Done.
Done means merged and acceptance criteria satisfied. In review means a PR exists,
not that it has merged. Sol may mark a reviewed draft Ready once its blockers and
dependencies are resolved; drafting is not permission to claim checks passed.

Ticket checks run on the implementation revision, not while drafting Markdown.
Use Node 24 and the pinned pnpm with the lightweight verification policy above.
Never reset shared databases or delete volumes. Isolate and clean only test-owned
records and keys. Runtime mocks cannot prove uniqueness or Redis atomicity.

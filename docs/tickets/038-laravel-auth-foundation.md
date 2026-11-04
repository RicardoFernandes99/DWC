# 038: Scaffold the Laravel backoffice and connect admin authentication

- Macro: M08
- Status: In review
- Depends on: 003, 009
- PR: https://github.com/RicardoFernandes99/DWC/pull/52
- Branch / parent: `codex/age-038-laravel-auth-foundation` / `codex/age-037-admin-inspection-api` at `a17919212aa70d1acbad35309e11b86ee501148b`
- Blockers: None. Tooling and authentication/session choices are recorded in product decisions.

## Outcome

A local Laravel backoffice authenticates real administrators against NestJS and
provides the shell for admin screens, without duplicating business rules.

## Read first

[Architecture boundary](../architecture.md#boundaries),
[admin scope](../product-decisions.md#laravel-administration-and-suspension),
auth 003 and admin 009 contracts. Tooling and the auth boundary are recorded in
the product decisions for Laravel 13, PHP 8.4 and Blade.

## Scope and contract

- Resolve supported Laravel/PHP/runtime/view tooling and local startup commands
  before scaffolding `apps/backoffice`. Laravel necessarily uses PHP; the existing
  TypeScript rule remains in force for Web/API and their authored scripts.
- Agree how Laravel holds/refreshes NestJS admin credentials and protects its own
  browser session/CSRF boundary. Do not guess cookie sharing across apps/ports,
  expose access tokens in rendered pages or build a second password/user store.
- Introduce app-specific AGENTS/setup guidance, secret examples and compatible
  formatting/static-analysis checks. Preserve existing pnpm apps/lockfile workflows.
- Implement login/logout, current-admin gate, session expiry and a minimal shell.
  NestJS continues enforcing authorization for every administrative operation.
- No React admin, business CRUD screens, cloud deployment or incidental database
  migration that replaces MongoDB domain persistence.

## Acceptance criteria

- [x] Real admin signs in/out; buyer/producer cannot enter the backoffice.
- [x] Expired/revoked API session and CSRF failures are handled without token leakage.
- [x] Local setup/start/check commands are reproducible and documented.
- [x] Existing React/NestJS dev/build/check behavior remains intact.
- [x] Chosen runtime/view/static-analysis contracts are recorded for later tickets.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use the selected Laravel formatter/static analysis, then manually log in/out and try an expired/non-admin session. Do not create a PHP e2e suite by default.

## Delivery notes

Implemented with Laravel framework 13.40.0, PHP 8.4.27, Blade, Pint and Larastan
3.14.0 in an optional Docker Compose profile. The user explicitly chose this
stack and automatic API refresh within a separate server-side Laravel session.

- Builder: `gpt-6-luna`, high effort for the cross-runtime authentication boundary.
  No model adaptation or formal correction rounds. Initial implementation review
  feedback fixed session mapping, exception cache headers, Docker environment
  passthrough and shell typography before approval. Usage/cost is unavailable.
- Frontier verdict: APPROVED on implementation `87a0926aa7908d50b9d4430b129f6393a6bcbe1b`
  against PR #51 at the parent SHA above. PR #52 is ready for review in native
  GitHub stack #34. No merge. The orchestrator removed one trailing space from
  the copied font license before committing; the license text is unchanged.
- Passed `pnpm backoffice:setup`, actual PHP platform requirements, Pint on 27
  PHP files and Larastan. Passed API typecheck/build, web typecheck/build including
  React Compiler verification, tools typecheck, root lint, contract generation
  and contract check, scoped Prettier and `git diff --check`.
- The existing `pnpm dev` command still runs React/NestJS. The backoffice starts
  separately on loopback port 8080. Its Docker development server uses
  `--no-reload` to preserve environment overrides and forces debug output off.
  Restart it after environment changes. Normal infrastructure configuration also
  validates before the optional backoffice environment file exists.
- Real Chrome, NestJS, MongoDB and Redis verification passed admin login/logout,
  buyer/producer refusal, current-role changes, missing-token CSRF 419/no-store,
  actual expired JWT refresh, two concurrent refresh requests, fixed absolute
  expiry, Redis revocation and absence of API credentials from HTML/browser
  cookies. Only disposable fixture users and sessions were cleaned.
- Real cross-origin missing-token browser navigation showed the custom 419 view.
  A separate temporary backoffice container with an unreachable API produced a
  sanitized 503/no-store page without interrupting shared services. Keyboard
  field/button order and all three responsive ranges passed.
- Browser evidence is local under `demos/ticket-038-review/`, covering login,
  shell, invalid credentials, non-admin and revoked sessions, logout, CSRF expiry
  and API unavailability. Initial/final shell images show the typography fix.
  Interface-design and taste app-screen guidance retained Orchard's palette,
  Fraunces and existing photograph. Accent ladder seed 1978245489 kept palette
  and type. Layout inspection reported zero failures at 390/900/1440; source
  lint reported zero failures with the explicit neutral-photo-scrim exception.
- Global local formatting reports existing checkout line endings and preserved
  older untracked demo files. Ticket-owned files pass scoped formatting; no
  unrelated reformat was performed.
- The shell intentionally has no business screens or speculative navigation.
  File sessions/cache locks are local, and the PHP development server serializes
  requests; the parallel request probe is not a multi-worker load test. Logout
  clears the Laravel session even if API revocation is unavailable; API
  revocation is best-effort during an outage. Local HTTP is the verified runtime.

# 038: Scaffold the Laravel backoffice and connect admin authentication

- Macro: M08
- Status: Blocked
- Depends on: 003, 009
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Choose Laravel/PHP tooling and its NestJS authentication/session integration

## Outcome

A local Laravel backoffice authenticates real administrators against NestJS and
provides the shell for admin screens, without duplicating business rules.

## Read first

[Architecture boundary](../architecture.md#boundaries),
[admin scope](../product-decisions.md#laravel-administration-and-suspension),
auth 003 and admin 009 contracts. No PHP application exists yet.

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

- [ ] Real admin signs in/out; buyer/producer cannot enter the backoffice.
- [ ] Expired/revoked API session and CSRF failures are handled without token leakage.
- [ ] Local setup/start/check commands are reproducible and documented.
- [ ] Existing React/NestJS dev/build/check behavior remains intact.
- [ ] Chosen runtime/view/static-analysis contracts are recorded for later tickets.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use the selected Laravel formatter/static analysis, then manually log in/out and try an expired/non-admin session. Do not create a PHP e2e suite by default.

## Delivery notes

Not implemented. Resolve the named tooling/auth decisions before starting.

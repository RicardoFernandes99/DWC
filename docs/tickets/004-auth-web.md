# 004: Register, sign in and restore a browser session

- Macro: M01
- Status: Draft
- Depends on: 003, 045
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Visitors can register or sign in; returning users restore their session without
putting credentials in browser storage. Producers see their current status.

## Read first

- [Accounts](../product-decisions.md#accounts-and-producer-onboarding) and
  [public browsing](../product-decisions.md#public-browsing-catalogue-and-cart).
- [Session contract](003-auth-sessions-api.md) and [registration](001-registration-api.md).
- Web guidance, `web-feature`, `design-engineering` and React performance guidance.
- [UI guidelines](../ui-guidelines.md) and the visual specimen from 045.
- Existing `apps/web/src/main.tsx`, `apps/web/src/app.tsx`,
  `apps/web/src/components/ui/button.tsx`, `apps/web/src/app.test.tsx`,
  `apps/web/vite.config.ts` and `apps/web/package.json`.

## Scope and contract

- Introduce the preferred TanStack Router, Query and Form integrations with
  these actual consumers. Keep React Compiler enabled and use existing tokens/
  shadcn/ReUI controls. Do not replace the starter with a generic dashboard.
- Routes: `/login`, `/register`, `/account` and a minimal `/producer` status page.
  Keep `/` public. Do not create catalogue/order/auction screens yet.
- Preserve a development-only entry to the 045 specimen when introducing routing.
- Registration collects name, email, password and buyer/producer selection using
  001 validation. After 201, call login. If login fails after account creation,
  explain the account exists and offer sign-in, rather than retrying registration.
- Successful login/registration navigates to `/account` for buyers or `/producer`
  for producers, unless resuming an allowed same-origin return path. Never allow
  an external return URL. Public visitors are not redirected away from `/`.
- A small shared HTTP/session client keeps access JWT in memory only. Cookies
  use credentials. On reload, attempt refresh before deciding authenticated route
  access. A single in-flight refresh serves concurrent 401s; retry a failed
  authenticated request at most once, then clear session on authentication failure.
- Derive HTTP request/response types from Nest OpenAPI using reproducible generation
  and a drift check; use typed endpoint calls rather than duplicating DTO interfaces
  or casting arbitrary JSON as a trusted response. Follow the shared standards in
  the ticket index. Do not weaken runtime API validation.
- Do not refresh recursively on login/refresh/logout, or repeat a successful
  mutation. Handle temporary 503/network failures as retryable UI errors rather
  than an infinite loop or invented success. Logout calls the API, clears user
  state/caches and reports a server revocation failure honestly.
- Pending producer UI displays "Pending approval" and no creation tools.
  Rejected state displays the reason when the onboarding contract provides it;
  correction/resubmission belongs to M02. Suspended state uses the agreed banner.
  Build no pretend approval endpoint, role switcher or admin UI.
- Client routing only presents permissions. API authorization remains decisive.
  Leave future guest-cart data alone during auth transitions; do not create a
  cart implementation or clear unrelated browser storage in this ticket.

## Acceptance criteria

- [ ] Registration/login work against the real API, including producer pending state.
- [ ] Duplicate email and incorrect credentials give useful field/form feedback.
- [ ] Reload restores a valid session without an unauthenticated redirect flash.
- [ ] Multiple expired requests trigger one refresh; refresh failure stops retries.
- [ ] Access/refresh tokens never reach localStorage, sessionStorage, URLs or logs.
- [ ] Logout clears user-scoped state; signing in as another user exposes no old data.
- [ ] Forms have labels/autocomplete, keyboard access, visible focus, pending and error
      states; invalid input is preserved appropriately and duplicate submits are blocked.
- [ ] Screens work below 768px, at 768-1279px and at 1280px+, without overflow.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Try registration, login, reload/session restore and logout in a browser. Check an incorrect password, responsive layout and keyboard access.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

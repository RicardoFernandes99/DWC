# 003: Sign in, refresh and revoke Redis-backed sessions

- Macro: M01
- Status: In review
- Depends on: 001, 002
- PR: https://github.com/RicardoFernandes99/DWC/pull/9
- Branch / parent: codex/age-003-auth-sessions-api / main
- Blockers: None beyond dependencies

## Outcome

Registered users can sign in and remain signed in through a refresh cookie.
Logout revokes the session. The same access JWT can authenticate Socket.io later.

## Read first

- [Account decisions](../product-decisions.md#accounts-and-producer-onboarding).
- Tickets [001](001-registration-api.md), [002](002-redis-integration.md).
- API guidance, `api-feature` and `nestjs-best-practices`.
- Existing `apps/api/src/main.ts`, `apps/api/src/config.ts`,
  `scripts/setup-local.ts` and the user/Redis modules introduced by dependencies.

## Scope and contract

- `POST /api/auth/login`, body `{ email, password }`: 200 with
  `{ accessToken, expiresIn: 900, user }` and an opaque refresh cookie. Normalize
  email as in 001; wrong email/password share the same generic 401 response.
- `POST /api/auth/refresh`: consume the cookie, rotate it and return the same
  response shape. Invalid/expired/reused credentials return 401. Redis rotation
  must be atomic so concurrent refreshes cannot both use the same credential.
- `POST /api/auth/logout`: revoke the cookie's session and clear its cookie;
  return 204, including an already absent/invalid session. Do not revoke other
  device sessions. Browser code must not automatically refresh/retry logout.
- `GET /api/auth/me`: bearer-authenticated 200 with the public user DTO from 001.
  Invalid/expired/revoked JWTs return 401. Load current user/producer status rather
  than treating stale token role/status claims as current permissions.
- Agreed lifetimes: access JWT 15 minutes; session 7 days. Implementation default:
  the 7-day session expiry is absolute from login and does not slide on refresh.
- JWT contains user/session IDs, issued/expiry claims and configured issuer/
  audience. Validate signature/algorithm/issuer/audience, current session and user.
  Redis stores hashed refresh credentials, user/session IDs and TTL, never raw
  tokens. Session revocation invalidates its access tokens immediately on the
  next authenticated request. Redis failure fails closed with sanitized 503.
- Cookie default: `dwc_refresh`, HttpOnly, SameSite=Lax, Path=/api/auth, bounded
  lifetime, Secure when HTTPS is used. Local HTTP configuration is explicit.
  Refresh/logout validate the browser Origin against configured WEB_ORIGIN to
  prevent cross-site session actions. Enable credentials for that exact CORS
  origin; retain Vite `/api` proxy behavior. Document non-browser API testing.
- Bound input sizes and login attempts with focused throttling and documented
  429 responses. Use an existing compatible Nest solution rather than a general
  abuse-prevention platform. Add required secrets to startup validation/example
  and random local generation without overwriting existing `.env` files.
- Pending/rejected/suspended producers may sign in to view status and fulfil
  permitted existing work. Do not globally lock them out or implement unfinished
  buyer suspension rules. No roles/status updates are exposed in this ticket.
- No Socket.io server, email verification, recovery flow or Laravel auth here.

## Acceptance criteria

- [x] Valid login, authenticated `/me`, refresh and logout work through real HTTP.
- [x] Wrong credentials, altered/expired JWTs and revoked sessions are rejected.
- [x] Cookie flags/paths and Origin rejection match the contract without leaking tokens.
- [x] A refresh token works once; concurrent use has at most one successful rotation.
- [x] Logout invalidates existing access JWTs for that session, not other sessions.
- [x] Refresh never extends the original 7-day limit; Redis TTL matches remaining time.
- [x] Redis outage does not authenticate callers or disclose internal connection data.
- [x] OpenAPI describes bearer/cookie usage, bodies, results and expected failures.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Exercise login, refresh, logout and rejection of the revoked session with real local requests. A small focused refresh-race check is optional where useful.

## Delivery notes

Implemented on `codex/age-003-auth-sessions-api`, parent `main` at
`d5b6f404e8ac301d4e2b6f6b127278167446bab4`. PR publication follows orchestrator review.

- Builder model: Sol, low effort for initial implementation; Terra, medium effort
  for final verification after the user's clarification. Token/credit usage is
  unavailable in this client.
- Node 24.22.1, pnpm 11.25.0. API typecheck/build, tools typecheck, root lint and
  existing API tests passed. Scoped Prettier checks passed.
- Real HTTP on isolated API port 3013 with existing MongoDB/Redis: login, `/me`,
  refresh, logout, pending-producer sign-in, generic wrong/unknown credentials 401,
  unexpected input 400, altered JWT 401 and missing/untrusted Origin 403 passed.
  Cookie HttpOnly/SameSite/Path/lifetime and exact credentialed CORS were checked.
- Concurrent refresh returned one 200 and one 401; reuse returned 401. Redis TTL
  before/after rotation was 604799789/604799770 ms. A shortened original session
  expiry remained bounded after refresh and then rejected refresh/access with 401.
  Stored session data contained hashes rather than raw refresh credentials.
- Logout immediately rejected the original access JWT while a second device's
  token still worked. The same JWT loaded changed producer status; deleting its
  test-owned user caused 401. Login throttling returned 429. OpenAPI contained all
  four routes and their response/authentication documentation.
- A separate API on port 3014 with an unreachable Redis port returned sanitized
  503 for valid-JWT `/me`, correct login and well-formed refresh. An expired,
  correctly signed JWT returned 401. Shared Redis was never stopped.
- Acceptance requests used temporary TypeScript scripts, removed after execution.
  Only test-owned users/session keys were cleaned. Existing `.env` was preserved;
  new runtime configuration was supplied to the isolated processes.
- Login throttling is process-local, appropriate to this single-process local
  application. A rotated credential is invalid for logout and cannot revoke its
  replacement. HTTPS Secure-cookie configuration is implemented; HTTP flags were
  exercised locally. No Socket.io or frontend session flow is included.

- Frontier verdict: APPROVED on implementation commit 9a11242. One correction
  round tightened persisted-session validation and absolute expiry. Final
  verification required no further code corrections. PR #9 is ready for review.

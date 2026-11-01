# 003: Sign in, refresh and revoke Redis-backed sessions

- Macro: M01
- Status: Draft
- Depends on: 001, 002
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] Valid login, authenticated `/me`, refresh and logout work through real HTTP.
- [ ] Wrong credentials, altered/expired JWTs and revoked sessions are rejected.
- [ ] Cookie flags/paths and Origin rejection match the contract without leaking tokens.
- [ ] A refresh token works once; concurrent use has at most one successful rotation.
- [ ] Logout invalidates existing access JWTs for that session, not other sessions.
- [ ] Refresh never extends the original 7-day limit; Redis TTL matches remaining time.
- [ ] Redis outage does not authenticate callers or disclose internal connection data.
- [ ] OpenAPI describes bearer/cookie usage, bodies, results and expected failures.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Exercise login, refresh, logout and rejection of the revoked session with real local requests. A small focused refresh-race check is optional where useful.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

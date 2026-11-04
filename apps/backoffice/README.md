# DWC backoffice

The DWC backoffice uses Laravel 13, PHP 8.4 and Blade. It authenticates through
the NestJS API and stores only short-lived API credentials in encrypted,
server-side file sessions. NestJS remains the source of administrator identity,
authorization and domain rules. No SQL user database or migrations are used.

## Local setup

Requirements are Node 24, pnpm 11.25 and Docker Compose v2. Host PHP and
Composer are not required.

```sh
pnpm backoffice:setup
pnpm backoffice:dev
```

The app runs at `http://localhost:8080`. Configure the root `.env` with
`BACKOFFICE_ORIGIN=http://localhost:8080`; `pnpm setup:local` adds this setting
to an existing `.env` without replacing its credentials. Laravel calls the API
at `http://host.docker.internal:3000/api` from its container. Keep the API
running with the usual `pnpm --filter @dwc/api dev` command.

After changing Composer dependencies, run `pnpm backoffice:setup` again.
`pnpm backoffice:format` applies Pint. `pnpm backoffice:check` builds the PHP
8.4 image if needed, checks actual platform requirements, then runs Pint and
Larastan. `pnpm backoffice:dev` runs the Compose `backoffice` profile on loopback
port 8080. Stop that foreground command with Ctrl+C.
The Laravel server uses `--no-reload` so Compose environment values reach PHP;
restart `backoffice:dev` after changing `apps/backoffice/.env`.

## Authentication boundary

The browser has a separate HttpOnly `dwc_backoffice_session` cookie protected
by Laravel's CSRF middleware. Laravel keeps the API access token, opaque refresh
cookie and the API cookie's absolute expiry in an encrypted file session. Each
protected request calls `/auth/me`; it refreshes once after an access-token 401.
It clears expired/revoked and non-admin sessions and shows a safe unavailable
page when the API cannot be reached. Internal errors and credentials are not rendered
or logged. Logout always clears the Laravel browser session; API revocation is
best effort if the API is unavailable.

The API accepts the exact `BACKOFFICE_ORIGIN` for refresh and logout while
`WEB_ORIGIN` continues to govern React and Socket.IO. API login is server-to-
server and does not forward the browser's cookies.

## Producer decisions

The signed-in administrator can open **Producer applications** from the home
screen. The list reads submitted applications from NestJS, accepts `status` and
1-based `page` filters, and requests at most 20 rows per page. Select a farm to
review its submitted name, description, collection address, city and coordinates.

Approve and reject are available only while an application is pending. Rejection
requires a 1–500 character reason. Suspension is a separate account-standing
action available only to an approved producer; it requires a reason of the same
length. The confirmation explains that suspension hides normal-sale products
and blocks new sales and auctions while existing orders and active auctions
continue. Reinstatement is available only while suspended and returns the
producer to approved without changing product publication or moderation state.

Every decision sends the current revision to NestJS once. The API decides whether
the transition is valid. On a stale revision the backoffice reloads the current
record and retains the submitted reason for review; it never retries the action.
If an API 401/403 arrives after the page gate, Laravel revokes the current API
cookie when possible, clears the encrypted session and returns the administrator
to sign-in. A connection loss during a decision reports that the outcome is
unknown and retains the reason draft until the administrator refreshes the
producer's current status. If the current-identity check returns 503 before the
decision controller runs, the backoffice retains only the validated reason,
action and producer ID, says the mutation was not sent, and links to the
producer's status page for recovery.

The login photo is the existing local Orchard landscape asset from the web app.
Fraunces is copied with its SIL Open Font License notice in `public/fonts`.

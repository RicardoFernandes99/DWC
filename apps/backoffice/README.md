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
page when the API cannot be reached. API errors and credentials are not rendered
or logged. Logout always clears the Laravel browser session; API revocation is
best effort if the API is unavailable.

The API accepts the exact `BACKOFFICE_ORIGIN` for refresh and logout while
`WEB_ORIGIN` continues to govern React and Socket.IO. API login is server-to-
server and does not forward the browser's cookies.

The login photo is the existing local Orchard landscape asset from the web app.
Fraunces is copied with its SIL Open Font License notice in `public/fonts`.

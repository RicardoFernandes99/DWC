# Backoffice instructions

This app is Laravel 13, PHP 8.4 and Blade. Root project scope, architecture and
product decisions apply. The root pnpm wrappers use Docker so host PHP and
Composer are not required.

## Boundaries

- NestJS is the only user/password store and the authority for roles and all
  business decisions. Do not add SQL user models, migrations or fake admin data.
- Keep API access tokens and opaque refresh-cookie values in the encrypted,
  server-side Laravel file session. Never put credentials in HTML, JavaScript,
  browser cookies, URLs, logs or exception messages.
- Check `/api/auth/me` on every protected request. Refresh only after its 401,
  once, with the captured opaque cookie and configured `BACKOFFICE_ORIGIN`.
  Honor the refresh cookie's fixed absolute expiry. Never retry mutations.
- Laravel's independent `dwc_backoffice_session` cookie and CSRF middleware
  protect browser requests. Preserve route session locks around login, protected
  pages and logout. Do not forward browser cookies to NestJS.
- Treat API timeouts and malformed responses as sanitized unavailable errors.
  Clear expired/revoked or non-admin sessions, and revoke the current API cookie
  when possible. Never trust a role from stored browser state.
- Keep this app Blade-only. Do not add React, a frontend build chain or links to
  unfinished admin features.

## Local commands

From the repository root, run `pnpm backoffice:setup`, then
`pnpm backoffice:dev`. The app listens on `http://localhost:8080` and calls the
host API at `http://host.docker.internal:3000/api`. The API environment must
allow `BACKOFFICE_ORIGIN=http://localhost:8080`.

Use `pnpm backoffice:format` for Pint and `pnpm backoffice:check` for Pint plus
Larastan. The app has no local SQL database or migrations.
Restart `pnpm backoffice:dev` after changing `apps/backoffice/.env`; the PHP
server uses `--no-reload` so its process receives the Compose environment.

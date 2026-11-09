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
- Keep this app Blade-only: no React and no links to unfinished admin features.
  UI comes from BlatUI (Blade components + Tailwind v4 + Alpine). Its copied
  components live in `resources/views/components/ui` (add more with
  `php artisan blatui:add <name>`); DWC wrappers such as `x-page`, `x-section`,
  `x-tabs` and `x-status-pill` sit beside them. Views use those, not raw markup.
- The only frontend build is Vite (`resources/css` and `resources/js` into
  `public/build`, never committed). The `backoffice-assets` Compose service
  runs it; `pnpm --filter @dwc/backoffice build` runs it once. `blatui*.css/js`
  are vendored from the package: update them with `vendor:publish`, do not edit.

## Local commands

From the repository root, run `pnpm backoffice:setup`, then
`pnpm backoffice:dev` (or `pnpm stack:up` for the whole stack). The app listens
on `http://localhost:8080` and calls the containerized API at
`http://api:3000/api`; Compose sets `NEST_API_URL` and starts the API with it.
The API environment must allow `BACKOFFICE_ORIGIN=http://localhost:8080`.

Use `pnpm backoffice:format` for Pint and `pnpm backoffice:check` for Pint plus
Larastan. The app has no local SQL database or migrations.
Restart `pnpm backoffice:dev` after changing `apps/backoffice/.env`; the PHP
server uses `--no-reload` so its process receives the Compose environment.

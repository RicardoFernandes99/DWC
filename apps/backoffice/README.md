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

## Interface and assets

Pages use [BlatUI](https://packagist.org/packages/anousss007/blatui) (Blade
components, Tailwind CSS v4 and Alpine.js). The copied components are in
`resources/views/components/ui`; add more with `php artisan blatui:add <name>`.
DWC wrappers (`x-page`, `x-page-heading`, `x-section`, `x-tabs`, `x-status-pill`,
`x-reason-form` and others) are in `resources/views/components`. The theme maps
BlatUI's tokens to the web app's palette in `resources/css/app.css`.

Vite builds `resources/css` and `resources/js` into `public/build` (ignored by
Git). `pnpm backoffice:dev` starts the `backoffice-assets` Compose service, which
rebuilds when a view, stylesheet or script changes. To build once, run
`pnpm --filter @dwc/backoffice build` after `pnpm install`.

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

## Product and review moderation

Administrators can open product moderation and reported reviews from the home
screen. Both lists read 20 rows at a time from NestJS and retain the moderation
state filter in the page URL. Product state is labelled **Not hidden** or
**Hidden** separately from the producer's publication choice and archive state.
The list does not infer public availability from those fields because producer
approval is a separate condition.

Product and review detail pages show the current revision and the API's current
moderation record. Review details include report categories, notes, timestamps
and reporter names inside the administrator-only backoffice. Review comments
and report text render as escaped plain text. There are no public links to
reporter identities.

Hiding requires a 1–500 character reason and an explicit confirmation step. The
NestJS moderation API records the decision. Hiding a product leaves its producer
publication choice, stock, auction records and existing order snapshots intact.
It removes the product from public product views and checkout. Hiding a review
removes it from public review lists and rating totals while preserving its order
record and report context. The Laravel UI does not delete content or offer a
restore action.

Laravel sends each hide request once with the displayed revision. A stale or
already-hidden conflict redirects to the detail page, reloads current API state
and keeps the reason draft scoped to that content item. The administrator must
review the new state before taking another action. API 401/403 clears the
session and returns to sign-in. A malformed response or timeout after a mutation
shows an unknown outcome with a state-refresh link; an identity-check 503 before
the controller says the mutation was not sent. Neither failure retries the hide
request. List/detail API failures show a sanitized retry page.

## Marketplace inspection

The header links to read-only user, order and auction pages (the landing page is
the producer applications queue).
The lists use NestJS pagination with a default of 20 and a maximum page size of 50. Users can be filtered by role and producer status, orders by status, origin,
fulfilment method, buyer ID and producer ID, and auctions by status and producer
ID. Detail pages link to related users, orders and auctions. Auction bid history
has its own page controls. Unknown or malformed API values make the page
unavailable rather than being displayed as a known state.

Order pages display the stored item prices, line totals, fees, order total,
refund records and status history. Auction pages show the product snapshot and
settlement records returned by the API. The backoffice does not calculate domain
totals from current product data and does not offer repair or export actions.

Protected pages continue to check
the current NestJS administrator session, and the browser session is cleared
after an API 401 or 403.

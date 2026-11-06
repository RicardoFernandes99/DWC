# Do Campo à Mesa

Local producers, orders, and live auctions. A pnpm monorepo with a React web app
and NestJS API. MongoDB, Redis and Floci's S3 emulator run locally in Docker.

## Quick start

Prerequisites: Node.js 24 LTS, pnpm 11.25.0, Docker Engine, Docker Compose v2.
Use `.node-version`; install pnpm with `npm install --global pnpm@11.25.0` if needed.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm infra:up
pnpm dev
```

`setup:local` creates an ignored root `.env` with random local credentials only
when it does not exist. It never overwrites an existing environment file.
The API loads this file; Compose uses the same settings.

Local services: Web on port 5173, API on 3000, Swagger at `/api-docs` on the API,
MongoDB on 27017, Redis on 6379, and Floci's S3 endpoint on 4566.
Vite proxies `/api` and `/api-docs` to NestJS. All services use HTTP locally.

```sh
pnpm check          # formatting, contract drift, lint, typecheck, tests, production builds
pnpm smoke          # running API + MongoDB + Redis + storage round trip
pnpm infra:down     # stop services; retain named data volumes
pnpm --filter @dwc/web dev
pnpm --filter @dwc/api dev
```

`infra:up` also creates the private product-images bucket idempotently.
MongoDB runs as a single-node replica set for future transactional work.
Infrastructure ports bind to loopback; this is a development setup.

Redis uses a persistent `redis-data` volume, append-only persistence and a ping
health check. The API requires `REDIS_URL` at startup, manages a reconnecting
client, and includes Redis in dependency readiness. `setup:local` creates the
variable for new `.env` files but preserves existing ones; add
`REDIS_URL=redis://127.0.0.1:6379` manually to an existing `.env`. `pnpm infra:up`
starts Redis alongside the other services. Check it with:

```sh
docker compose exec redis redis-cli ping
```

The expected response is `PONG`. API readiness and `pnpm smoke` check MongoDB,
Redis, and S3. Smoke also verifies Redis value round-trip and expiration, and
removes only its randomly named key.

Floci uses persistent storage in the `floci-data` volume. The container's built-in
health check gates startup. Its optional web-console sidecar is disabled; no
Docker socket is needed for S3. Existing SDK credentials work as local emulator
credentials; Floci accepts any non-empty credentials by default.

When upgrading from the earlier RustFS setup, change `S3_ENDPOINT` in your
existing `.env` to `http://127.0.0.1:4566` and restart the API. `setup:local`
preserves existing files. Previous `storage-data` and `storage-logs` volumes are
left intact; objects are not migrated automatically to Floci.

## Layout

```text
apps/web/         React, React Compiler, Vite, Tailwind, shadcn/ui, ReUI registry
apps/api/         NestJS, MongoDB, S3 client, Swagger, readiness checks
docs/             project scope, architecture, agent workflow and research
.agents/skills/   canonical skills for Codex and Claude Code
.claude/skills/   symlink to the shared skills
```

The Laravel backoffice lives in `apps/backoffice`. Start it alongside the API
with `pnpm backoffice:setup` once, then `pnpm backoffice:dev` in a separate
terminal. It listens on port 8080 and authenticates administrators through the
API. Root `setup:local` adds `BACKOFFICE_ORIGIN` to an existing `.env` without
replacing credentials. Run `pnpm backoffice:check` for Pint and Larastan.
Administrative business screens follow in later tickets.

## Working with agents

Start Codex or Claude Code from this repository. Read [AGENTS.md](AGENTS.md),
then the instructions for the app being changed. Claude entry points import
the same instructions. Skills are versioned once and shared by both tools.
See [the agent workflow](docs/agent-workflow.md) for discovery and sources.
No API key or agent CLI is installed by the project.

Local demo tools use `pnpm demo:install`, `pnpm demo:record` and
`pnpm demo:produce`. All footage and finished videos stay under [demos/](demos/README.md);
delivery uses local file paths. Rendering uses Google Fonts with system-font fallback.
FFmpeg/libx264 is needed for MP4 production.

See [scope](docs/project-scope.md) and [architecture](docs/architecture.md).
Cloud deployment, HTTPS, Bootstrap/SASS, and a separate prototype are outside
the current user-selected scope, despite appearing in the assignment brief.
The report should record these differences and declare AI assistance.

## Authentication API

Registered buyers and producers can sign in using `POST /api/auth/login` with
`{ email, password }`. The response contains `accessToken`, `expiresIn: 900` and
the public user. Keep the access token in memory and send `Authorization: Bearer
<accessToken>` to `GET /api/auth/me`. Every request checks the Redis session and
loads the current user and producer status.

Login also sets `dwc_refresh`, an opaque HttpOnly, SameSite=Lax cookie scoped to
`/api/auth`. `POST /api/auth/refresh` rotates it once. Sessions expire absolutely
seven days after login; refreshing never extends them. `POST /api/auth/logout`
revokes only that cookie's session, clears the cookie and returns 204 even when
the credential is missing or invalid. An already rotated credential is invalid
and cannot revoke its replacement. Do not automatically refresh or retry logout.

Both refresh and logout require `Origin` to equal `WEB_ORIGIN` exactly, including
requests from curl or other non-browser clients. Use a cookie jar for those
clients and send `Origin: http://localhost:5173` locally. Browser calls use
`credentials: 'include'`; CORS allows credentials only for the configured origin.
Swagger at `/api-docs` documents bearer and cookie authentication and failures.
Login permits ten attempts per IP per minute in this API process and returns 429
with retry headers when exceeded. DTOs bound credentials; invalid input returns
400, invalid credentials return 401, untrusted Origin returns 403, and unavailable
Redis returns a sanitized 503 without authenticating callers.

New environments receive a random `JWT_SECRET` from `pnpm setup:local`. For an
existing `.env`, add a random secret of at least 32 characters, `JWT_ISSUER=dwc-api`,
`JWT_AUDIENCE=dwc-web` and `AUTH_COOKIE_SECURE=false`. Generate the secret locally
with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
Setup never overwrites existing `.env` files. Local HTTP explicitly disables the
Secure flag; HTTPS requires `AUTH_COOKIE_SECURE=true`. `WEB_ORIGIN` must be an exact
origin with no path or trailing slash. JWTs use HS256 and validate issuer,
audience, signature and expiry. Redis stores session IDs, user IDs and SHA-256
refresh hashes with TTLs, never raw refresh credentials.

The Web auth client uses types generated from the Nest controllers and DTOs. Run
`pnpm contract:generate` after changing those contracts; `pnpm contract:check`
checks for drift without requiring the local services. Add newly consumed controllers
to the contract-only module in `apps/api/src/export-web-contract.ts`.

## UI Design

Open `/ui-design` from the home page for the selected Orchard desktop/mobile
concept board and source images. These visual references establish the UI
baseline for future shadcn/ui and ReUI implementation.

## Producer application review and admin bootstrap

Public registration (`POST /api/auth/register`) only creates `buyer` and `producer`
accounts. Create a local administrator account deliberately with:

```sh
pnpm --filter @dwc/api admin:bootstrap -- --name "Local Admin" --email "admin@example.com" --password "<8..72-byte-secret>"
```

`ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are
also accepted from the environment. The bootstrap command hashes the password with
bcrypt, refuses to overwrite or promote an existing user, and never logs credentials.

Authenticated administrators can inspect and decide submitted producer applications:

- `GET /api/admin/producer-applications` — paginated list (`page`, `limit`, optional `status`).
- `GET /api/admin/producer-applications/:id` — application review details and current `revision`.
- `POST /api/admin/producer-applications/:id/approve` — atomically approves a pending application matching `{ revision }`.
- `POST /api/admin/producer-applications/:id/reject` — atomically rejects a pending application matching `{ revision, reason }`.
- `POST /api/admin/producers/:id/suspend` — suspends an approved producer matching `{ revision, reason }` (reason 1-500 chars, shown to the producer). Notifies the producer.
- `POST /api/admin/producers/:id/reinstate` — returns a suspended producer to approved matching `{ revision }` and clears the reason. Notifies the producer. Other statuses answer `409`.

## Local demo fixtures

With local MongoDB running, stop the API and other processes that write marketplace data. Then run:

```powershell
$env:FIXTURE_MAINTENANCE_ACK = 'stopped'
pnpm --filter @dwc/api fixtures --create
Remove-Item Env:FIXTURE_MAINTENANCE_ACK
```

The command builds the API first, then inserts a deterministic set of buyers, producer states, products, catalogue orders, refund cases, reviews, and auctions in one MongoDB transaction. This narrow fixture-only setup writes historical records directly through the API's Mongoose schemas, so it does not replay registration, checkout, refund, review, approval, or bidding workflows. It does not change production services, API contracts, or authentication; sign-in still uses normal password verification and role checks. It uses generated demo passwords stored in the ignored local file `demos/ticket-044-review/credentials.local.json`. The command never prints passwords or password hashes. Card details are dummy metadata ending in `4242`; no payment is sent. Product images are omitted, so fixture setup creates no S3 objects. It does not create Redis sessions.

Product stock balances against the fixture history. Vegetables start at 20 units: 14 available, 1 reserved for the upcoming auction, 3 sold in catalogue orders, and 2 sold in the finished auction. Eggs start at 5 boxes: 2 available, 1 reserved for the active auction, and 2 sold in catalogue orders. Jam has 10 jars available after an accepted refund restores 2 jars.

The command targets only a local MongoDB host and refuses to run while an API answers on `API_PORT` (default `3000`). The maintenance acknowledgement also applies to other writers, including additional API processes. A second `--create` checks that all manifest-owned records still exist and makes no changes. It never repairs partial data or resets demo interactions. Checkout request hashes in these historical records are fixture placeholders, not live checkout idempotency keys. If a fixture record is missing or the local credentials file is lost, run cleanup, then create again. Cleanup tolerates missing manifest-owned records but still refuses foreign references.

Remove the fixture namespace after stopping writers with:

```powershell
$env:FIXTURE_MAINTENANCE_ACK = 'stopped'
pnpm --filter @dwc/api fixtures --cleanup
Remove-Item Env:FIXTURE_MAINTENANCE_ACK
```

Cleanup checks incoming and outgoing references before deleting manifest-owned records in a transaction. If another record refers to a fixture record, cleanup stops and preserves both the records and local credentials. Resolve that reference yourself, then retry. It deletes only listed fixture IDs and removes only the fixture credentials file. Do not edit the ownership manifest or run create/cleanup while any other data writer is active.

## Public catalogue

Catalogue browsing does not require authentication. `GET /api/products` accepts
bounded text, category, producer, city, season, production method, integer-cent
price range, sort (`newest`, `price_asc`, `price_desc`, `name_asc`), page and limit
filters. Product details are available at `GET /api/products/:id`. Producer
profiles use `GET /api/producers` and `GET /api/producers/:id`; public products for
one producer use `GET /api/producers/:id/products`. Public results include only
published, unarchived, unmoderated products belonging to currently approved
producers with a producer application. Responses expose allowlisted profile and
product fields; stored product images receive short-lived signed URLs.

## Purchase receipts

`GET /api/orders/:orderId/receipt.pdf` downloads a PDF receipt for a catalogue
order or auction win. The buyer or that order's producer must sign in. Admins
use the separate `GET /api/admin/orders/:id/receipt.pdf` endpoint. Both routes
return private, non-cacheable attachments; there are no public links. New
purchases snapshot the buyer name and producer farm name. Older orders show
stable account references and state that historical names were not recorded.
Receipts preserve original order amounts and show any order-specific refund,
cancellation date and remaining paid amount. The document is a purchase receipt,
not a tax invoice.

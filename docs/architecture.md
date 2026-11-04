# Architecture

## Boundaries

`apps/web` is a React SPA using Vite, Tailwind CSS, shadcn/ui primitives and a
ReUI registry. Compiler integration uses the current Vite 8/plugin-react 6
`reactCompilerPreset` through `@rolldown/plugin-babel`. ESLint includes React
Compiler diagnostics. Production builds check for emitted compiler markers.

`apps/api` is the NestJS authority for domain logic, permissions, persistence
and future Socket.io events. TypeScript emits decorator metadata for Nest's
dependency injection. Swagger and global request validation are initialized.
Buyer/producer registration persists users with bcrypt password hashes and an
indexed normalized email. Authentication issues 15-minute HS256 JWTs backed by absolute seven-day Redis
sessions. Refresh uses atomic Lua compare-and-set rotation; logout revokes only
the current cookie session. Each authenticated request verifies JWT signature,
issuer/audience, session existence and current MongoDB user status.

`apps/backoffice` is Laravel 13 on PHP 8.4 with Blade. Its separate browser
session uses encrypted, file-backed Laravel sessions and CSRF protection; the
session stores NestJS access and opaque refresh credentials server-side only.
Every protected request checks `GET /api/auth/me`, refreshing once after an
access-token 401. The API's refresh-cookie expiry sets the absolute seven-day
session cap. Laravel sends `BACKOFFICE_ORIGIN` for refresh and logout; NestJS
continues to use `WEB_ORIGIN` for the React app and Socket.IO. NestJS remains the
only user store and the authority for roles and business rules. Laravel does not
connect to MongoDB or create a second SQL user database. See the backoffice
README and app guidance for the Docker-based runtime and checks.

## Local services

Docker Compose retains MongoDB, Redis and Floci state in named volumes. The Node apps run
on the host for fast iteration. MongoDB runs one replica set member; the host
connection uses `directConnection=true` to avoid container DNS discovery issues.
This supports atomic updates now and transactions when the domain needs them.

Redis 8.2 runs on loopback port 6379 with a `redis-cli ping` health check.
The `redis-data` volume and append-only persistence with a one-second fsync
policy retain data across normal restarts. Redis is intended for expiring
refresh-token sessions and revocation data when authentication is implemented.
Store token hashes or identifiers rather than raw bearer tokens, and expire
records with the associated session/token lifetime. JWT signature and expiry
checks remain in the API; MongoDB remains the store for users and domain data.
The API uses the official Node Redis client through a feature module. `REDIS_URL`
is required and validated at startup. Connection attempts and commands have
bounded timeouts, commands are not queued while disconnected, and the client
reconnects after interruptions. Redis readiness reports only `up` or `down`;
connection values and internal errors are not returned. Authentication fails closed with sanitized 503 responses during Redis outages.
Redis has no local authentication and must remain bound to loopback.

Floci 2.3.0 emulates S3 on port 4566. The AWS SDK uses endpoint configuration and
path-style requests, so the application can work with another compatible S3
provider later. A setup script creates the product-images bucket idempotently
without a public ACL; image authorization and upload endpoints are future work.
Floci accepts non-empty development credentials by default, so emulator success
does not verify production access control.

The container uses `FLOCI_STORAGE_MODE=persistent` with its own `floci-data`
volume at `/app/data` and the image's built-in readiness probe. Its optional
console sidecar is disabled; S3 does not need the Docker socket. Earlier RustFS
data/log volumes are preserved but not mounted into Floci or automatically
migrated, since the storage formats differ. Existing `.env` files need their
S3 endpoint changed from port 9000 to 4566 when upgrading.

Root `.env` is shared by Compose and the API; Vite reads only API_PORT for its
server-side proxy. No browser-side S3 credentials are injected. Infrastructure
ports and application listeners bind to loopback. The database has no local
authentication; do not expose this Compose configuration on a public interface.

Readiness pings MongoDB and Redis and checks the configured S3 bucket. The smoke
command also exercises database persistence, a Redis value round-trip and TTL,
and object upload/download/delete. These
checks do not imply catalogue, order or auction behavior is implemented.

Read-only administrator inspection lives in NestJS for the Laravel backoffice.
`GET /api/admin/users`, `/orders`, and `/auctions` use bounded pages, explicit
filters and stable timestamp/ID ordering. Detail responses select safe fields,
including order-specific refund allocations and auction settlement links. Admin
routes return `Cache-Control: no-store`. `GET /api/admin/health` reports bounded
MongoDB, Redis and storage checks without dependency errors or configuration.
The public `/api/health/ready` response remains unchanged. Because `AdminGuard`
checks the Redis-backed session, an HTTP admin health request may itself return
503 during a Redis outage; the health service can still report Redis as down when
called in-process.

## Realtime transport

Socket.IO runs on the API's existing HTTP server and configured `WEB_ORIGIN`.
The default namespace authenticates the access JWT through `AuthService` at
connection time, checking JWT claims, the Redis session and current MongoDB
user. The server derives personal rooms as `user:<userId>` and accepts no client
room-join commands. Personal notifications are published to authenticated
connections without repeating authentication before each event. The separate
`/auctions` namespace permits guest watching, derives auction rooms only from
validated auction IDs, and authenticates the supplied JWT/session/current buyer
and saved payment method for each bid. Auction state and history expose only
bounded public bidder snapshots. Both namespaces enforce the configured web
origin when supplied. See the [Socket.IO event contract](socket-events.md) for
event shapes and delivery limitations. Connections and viewer counts are
process-local; there is no multi-instance adapter.

## Tooling choices

pnpm workspaces provide filtering and recursive commands without an extra task
runner for two applications. One lockfile, strict TypeScript, ESLint, Prettier,
web interaction tests and API behavior tests keep agent feedback reproducible.
Add shared libraries when actual feature code demonstrates a useful boundary.

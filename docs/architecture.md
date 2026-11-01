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

`apps/backoffice` will hold Laravel. Prefer consuming authenticated NestJS
administrative endpoints to avoid duplicating business rules. Choose its auth
flow and PHP tooling when scaffolding that app.

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

## Tooling choices

pnpm workspaces provide filtering and recursive commands without an extra task
runner for two applications. One lockfile, strict TypeScript, ESLint, Prettier,
web interaction tests and API behavior tests keep agent feedback reproducible.
Add shared libraries when actual feature code demonstrates a useful boundary.

# Architecture

## Boundaries

`apps/web` is a React SPA using Vite, Tailwind CSS, shadcn/ui primitives and a
ReUI registry. Compiler integration uses the current Vite 8/plugin-react 6
`reactCompilerPreset` through `@rolldown/plugin-babel`. ESLint includes React
Compiler diagnostics. Production builds check for emitted compiler markers.

`apps/api` is the NestJS authority for domain logic, permissions, persistence
and future Socket.io events. TypeScript emits decorator metadata for Nest's
dependency injection. Swagger and global request validation are initialized.
No authentication or business endpoints are claimed by this initial scaffold.

`apps/backoffice` will hold Laravel. Prefer consuming authenticated NestJS
administrative endpoints to avoid duplicating business rules. Choose its auth
flow and PHP tooling when scaffolding that app.

## Local services

Docker Compose retains MongoDB and Floci state in named volumes. The Node apps run
on the host for fast iteration. MongoDB runs one replica set member; the host
connection uses `directConnection=true` to avoid container DNS discovery issues.
This supports atomic updates now and transactions when the domain needs them.

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

Readiness pings MongoDB and checks the configured S3 bucket. The smoke command
also exercises database persistence and object upload/download/delete. These
checks do not imply catalogue, order or auction behavior is implemented.

## Tooling choices

pnpm workspaces provide filtering and recursive commands without an extra task
runner for two applications. One lockfile, strict TypeScript, ESLint, Prettier,
web interaction tests and API behavior tests keep agent feedback reproducible.
Add shared libraries when actual feature code demonstrates a useful boundary.

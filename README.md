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
pnpm check          # formatting, lint, typecheck, tests, production builds
pnpm smoke          # running API + MongoDB + storage round trip
pnpm infra:down     # stop services; retain named data volumes
pnpm --filter @dwc/web dev
pnpm --filter @dwc/api dev
```

`infra:up` also creates the private product-images bucket idempotently.
MongoDB runs as a single-node replica set for future transactional work.
Infrastructure ports bind to loopback; this is a development setup.

Redis uses a persistent `redis-data` volume, append-only persistence and a ping
health check. It is reserved for expiring authentication session/revocation data;
the API client and authentication flows are not implemented yet. The future API
connection is `REDIS_URL=redis://127.0.0.1:6379`. Existing `.env` files are preserved;
add that setting when the API integration is implemented. `pnpm infra:up` starts
Redis alongside the other services. Check it with:

```sh
docker compose exec redis redis-cli ping
```

The expected response is `PONG`. API readiness and `pnpm smoke` currently check
MongoDB and S3 only; Redis startup is checked by Compose.

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

Laravel backoffice remains planned as `apps/backoffice`; it is not scaffolded in
this Web/API foundation. Business features are not implemented yet.

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

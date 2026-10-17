# Do Campo à Mesa

Local producers, orders, and live auctions. A pnpm monorepo with a React web app
and NestJS API. MongoDB and S3-compatible object storage run locally in Docker.

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
MongoDB on 27017, S3 on 9000, and the storage console on 9001.
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

See [scope](docs/project-scope.md) and [architecture](docs/architecture.md).
Cloud deployment, HTTPS, Bootstrap/SASS, and a separate prototype are outside
the current user-selected scope, despite appearing in the assignment brief.
The report should record these differences and declare AI assistance.

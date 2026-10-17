---
name: local-development
description: Install, run, validate, or troubleshoot the DWC monorepo and its local MongoDB and S3 services. Use for environment setup, service startup, and connection failures.
---

# Local development

1. Read root and affected app `AGENTS.md` files. Use the existing checkout;
   cloud tasks are already isolated. Do not create a worktree unless requested.
2. Check `git status --short`, Node, pnpm, Docker, and Compose. Use the pinned
   versions and lockfile; do not upgrade dependencies to fix an unexplained error.
3. From the root run `pnpm install --frozen-lockfile`, `pnpm setup:local`, then
   `pnpm infra:up`. Preserve existing `.env`; inspect variable presence, not values.
4. Run `pnpm dev` in a persistent terminal. Check `/api/health/ready` on the API
   and via Vite's `/api` proxy. A process or port alone does not prove readiness.
5. Run `pnpm smoke` to check OpenAPI, MongoDB persistence and S3 write/read/delete.
   Run `pnpm check` before claiming the full scaffold passes.
6. Inspect relevant logs after a failure. Check Docker service health, bucket
   initialization, replica set state, configured ports, and missing variables.
   Never print credentials or use `docker compose config` without suppressing
   interpolated secrets. Do not delete volumes to resolve startup problems.
7. In restricted cloud machines, put pnpm data/cache/store under a writable
   workspace location using XDG_DATA_HOME, XDG_CACHE_HOME and `--store-dir`.
   Keep host-specific paths outside committed package-manager configuration.
8. Report verified capabilities and blockers. Stop only processes you started
   when cleanup is needed. Preserve local data with `pnpm infra:down`.

# Working with Codex and Claude Code

DWC is a personal project. Keep the working loop short:

- Understand the request and read the relevant code/guidance.
- For a larger change, show a few implementation bullets in chat with `plan`.
  Use `grill-me` to settle meaningful open questions, one at a time.
- Implement the feature, run appropriate checks, and briefly explain the result.

Planning stays in the conversation. No PLAN.md/STATE.md artifacts, workflow
folders, tickets, ADRs, or separate execution/review/verification/delivery stages
are required. Save Markdown only when asked. A later Markdown ticket workflow can
be added when requested; it is not scaffolded now.

## Shared guidance and skills

Root and app `AGENTS.md` files are canonical. Each `CLAUDE.md` imports its matching
file with `@AGENTS.md`. Skills live in `.agents/skills/`; `.claude/skills` links to
the same directory so both tools use one copy. On Windows use a checkout with
symlink support, such as WSL; do not maintain separately edited skill copies.

Start the CLI at the repository root. Codex uses `$plan`, `$grill-me`, `$animate`,
etc.; Claude exposes the same skills as `/plan`, `/grill-me`, `/animate`, etc.
Skill descriptions also allow automatic matching. New skills should be available
on the next turn; refresh/restart the client if its discovery cache needs it.
The project does not install/authenticate agent CLIs or auto-enable MCP servers.

| Skill                         | Use                                                            |
| ----------------------------- | -------------------------------------------------------------- |
| `plan`                        | Short implementation bullets in chat                           |
| `grill-me`                    | Clarify scope and solve open decisions one question at a time  |
| `local-development`           | Install, start and troubleshoot local services                 |
| `web-feature`, `api-feature`  | Implement the affected app and check its behavior              |
| `scaffold-slice`              | A short checklist for a complete model/API/UI feature          |
| `nestjs-best-practices`       | Feature modules, DI, Mongoose and API boundaries               |
| `design-engineering`          | Composition, forms, accessibility and UI polish                |
| `animate`                     | Emil Kowalski-inspired motion, easing, timing and interruption |
| `record-demo`, `produce-demo` | Record and render local demonstration videos                   |

`grill-me` checks code before asking, gives a recommended answer, and keeps
confirmed decisions separate from assumptions and deferred questions. It stops
when there is enough clarity to implement or when the user wants to stop. It
feeds the inline plan without creating another approval step.

App guides distinguish installed libraries from preferred future choices. Add
TanStack/MSW tools with their first actual feature, not as planning scaffolding.
`animate` reuses shadcn/ReUI and existing tokens, prefers CSS, and does not install
Motion. Its principles/recipes and upstream MIT notice are included.

## Checks and local demos

Use focused app checks for ordinary changes. `pnpm check` covers formatting,
lint, types, tests and builds; `pnpm smoke` checks the running API/MongoDB/S3
integration. Do not call a skipped check a pass. Visual demos are optional
when useful, not a release gate for every change.

```sh
pnpm demo:install
pnpm demo:record doctor
pnpm demo:produce doctor
pnpm demo:test
```

Playwright is a root dev dependency; `demo:install` puts Chromium under ignored
`node_modules/.cache/ms-playwright`. MP4 production needs FFmpeg/libx264.
Recording needs a local app and display (or Xvfb) and OS capture permission.

All recordings, logs, screenshots, drafts, finished renders, posters and reviews
stay in root `demos/`; there is no upload step. Generated media is ignored.
Useful TypeScript take scripts and storyboards can be committed. See
[demos/README.md](../demos/README.md) and the two demo skills.

Recorder/producer settings live in `.agents/record-demo.ts` and
`.agents/produce-demo.ts`. No fake login hook is supplied; use real demo accounts
once authentication exists. Keep the live clock for auction demonstrations.
Draft and final filenames differ, and the producer enforces the five-minute limit.

Demo engines are attributed upstream JavaScript/Shell utilities. Their hashes and
local-delivery adaptations are in `.agents/skills/upstream.json`, with credits in
`.agents/skills/NOTICE.md`. Only those vendor files bypass authored lint/format
checks; DWC TypeScript adapters are checked normally. `demo:test` runs the renderer
tests. Other skills are guidance, not extra mandatory stages.

## Research sources

Checked 2026-10-17. Direct documentation-site requests returned HTTP 403 in
this environment, so the accessible official GitHub sources were used.

- [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
  and [official discovery implementation](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs).
- [Codex skills guide](https://developers.openai.com/codex/skills)
  and [official skill loader](https://github.com/openai/codex/tree/main/codex-rs/ext/skills/src/loader).
- [Claude memory guide](https://code.claude.com/docs/en/memory) and
  [official changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
  documenting CLAUDE.md imports, AGENTS.md support and project skill discovery.
- [Anthropic skill examples and format](https://github.com/anthropics/skills)
  and [skill development guide](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/skill-development/SKILL.md).
- [React Compiler installation source](https://github.com/reactjs/react.dev/blob/main/src/content/learn/react-compiler/installation.md).
- [shadcn Vite installation](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/installation/vite.mdx)
  and [ReUI registry configuration](https://github.com/keenthemes/reui/blob/main/components.json).
- [Floci Docker setup](https://github.com/floci-io/floci/blob/2.3.0/docs/configuration/docker-compose.md)
  and [storage modes](https://github.com/floci-io/floci/blob/2.3.0/docs/configuration/storage.md).

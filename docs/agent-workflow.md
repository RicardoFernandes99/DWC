# Working with Codex and Claude Code

DWC is a personal project. Keep the working loop short:

- Understand the request and read the relevant code/guidance.
- For a larger change, show a few implementation bullets in chat with `plan`.
  Use `grill-me` to settle meaningful open questions, one at a time.
- Implement the feature, run appropriate checks, and briefly explain the result.

Routine planning stays in the conversation. The user has now chosen numbered
Markdown tickets and stacked ready-for-review PRs for feature work. The agreed
behavior is recorded in the [feature roadmap](feature-roadmap.md), alongside
the macro outline; [product decisions](product-decisions.md) records the flows.
The [ticket drafts](tickets/README.md) cover all agreed macros and include a Sol orchestrator and
cheaper-builder handoff. Use `build N` or `$build N` in Codex, or `/build N` in
Claude, to invoke the project-local `build` skill. Plain `build` chooses the next
eligible ticket. It ingests, plans in chat, delegates implementation, reviews and
requests corrections, then opens a ready-for-review `Age N - ...` PR stacked on
the latest open feature PR. No separate PLAN.md/STATE.md files or ADRs are needed.
The main chat's selected frontier model remains orchestrator/reviewer, with Sol
Medium as the baseline. The build skill selects Luna Medium/High, Terra Medium or
Sol Medium according to the work and adapts from observed failures, correction
rounds and available usage evidence. Builders receive fresh, compact context.
Other clients need supported model selections. No automatic merge occurs.

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
For GitHub operations use authenticated GitHub CLI (`gh`), including PR discovery,
creation, updates and comments. The user prefers CLI attribution over the ChatGPT
Codex Connector. Do not silently fall back to the connector when CLI setup is missing.

| Skill                         | Use                                                               |
| ----------------------------- | ----------------------------------------------------------------- |
| `plan`                        | Short implementation bullets in chat                              |
| `build`                       | Ticket ingestion, cheaper builder, frontier review and stacked PR |
| `grill-me`                    | Clarify scope and solve open decisions one question at a time     |
| `local-development`           | Install, start and troubleshoot local services                    |
| `web-feature`, `api-feature`  | Implement the affected app and check its behavior                 |
| `scaffold-slice`              | A short checklist for a complete model/API/UI feature             |
| `nestjs-best-practices`       | Feature modules, DI, Mongoose and API boundaries                  |
| `design-engineering`          | Composition, forms, accessibility and UI polish                   |
| `animate`                     | Emil Kowalski-inspired motion, easing, timing and interruption    |
| `record-demo`, `produce-demo` | Record and render local demonstration videos                      |

`grill-me` checks code before asking, gives a recommended answer, and keeps
confirmed decisions separate from assumptions and deferred questions. It stops
when there is enough clarity to implement or when the user wants to stop. It
feeds the inline plan without creating another approval step.

App guides distinguish installed libraries from preferred future choices. Add
TanStack/MSW tools with their first actual feature, not as planning scaffolding.
`animate` reuses shadcn/ReUI and existing tokens, prefers CSS, and does not install
Motion. Its principles/recipes and upstream MIT notice are included.

## Checks and local demos

Use typecheck/lint/build and brief manual checks for ordinary changes. Unit,
integration and e2e tests are optional; add only small tests with clear value.
CI installs the frozen lockfile, then runs formatting, lint, typecheck and build.
It does not start Docker/services or run automated tests/smoke by default.
`pnpm check` still runs the existing full suite and `pnpm smoke` remains available
for troubleshooting, but neither is a mandatory per-ticket gate. Do not call a
skipped check a pass. Visual demos are optional
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
stay in root `demos/` and are delivered as local file paths. Generated media is ignored.
Useful TypeScript take scripts and storyboards can be committed. See
[demos/README.md](../demos/README.md) and the two demo skills.

Recorder/producer settings live in `.agents/record-demo.ts` and
`.agents/produce-demo.ts`. No fake login hook is supplied; use real demo accounts
once authentication exists. Keep the live clock for auction demonstrations.
Draft and final filenames differ, and the producer enforces the five-minute limit.

Demo engines are attributed upstream JavaScript/Shell utilities. Their hashes and
local-delivery adaptations are in `.agents/skills/upstream.json`, with their license
in `.agents/skills/shared/LICENSE`. Only those vendor files bypass authored lint/format
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

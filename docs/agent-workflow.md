# Codex and Claude Code

## Shared guidance

The canonical policy is `AGENTS.md`, with narrow app-specific instructions.
Read each affected app's instructions even when working from the root: scoped
discovery varies with tool version and current directory. `CLAUDE.md` files
import the corresponding `AGENTS.md` with `@AGENTS.md`; instructions are not
maintained twice. Current Claude releases also support AGENTS.md fallback, but
the imports retain compatibility with releases that expect CLAUDE.md.

Portable skills live in `.agents/skills/<name>/SKILL.md`. Each uses only the
shared `name` and `description` frontmatter fields and focused Markdown steps.
`.claude/skills` is a relative symlink to `../.agents/skills`, so the same source
is available through Claude's project skill discovery path.

On Windows, use a Git checkout with symlink support (for example WSL). If a
checkout turns the symlink into a plain text file, repair it before expecting
Claude skill discovery to work. Do not maintain two independently edited copies.

## Usage

Launch either CLI from the repository root. Ask Codex to use `$web-feature`,
`$api-feature`, `$local-development`, or `$review-change`. Claude exposes the
same skills as `/web-feature`, `/api-feature`, `/local-development`, and
`/review-change`. Descriptions also allow automatic matching. Skills added
mid-session may require refreshing/restarting the client before discovery.

The repository does not install agent CLIs, supply their authentication,
auto-enable MCP servers, bypass permissions, or require a vendor subscription.
No background agent jobs or remote message workflows are configured. Add hooks,
MCP servers or tool-specific subagents only when a concrete workflow needs them.
`pnpm check` and `pnpm smoke` are the shared verification interface.

The current setup verifies instruction imports and skill links on disk. Actual
client discovery still depends on the installed CLI and its trust/settings.

## Additional skills

The app `AGENTS.md` files now include library choices and architecture conventions;
`CLAUDE.md` imports remain the entry points for Claude. Preferred frontend libraries
are documented before installation; add them when their first feature needs them.

| Skill                         | Use                                                          |
| ----------------------------- | ------------------------------------------------------------ |
| `nestjs-best-practices`       | Feature modules, DI, Mongoose consistency and API boundaries |
| `design-engineering`          | React composition, forms, accessibility, loading and motion  |
| `plan`, `execute`             | Short plans and resumable implementation for larger changes  |
| `verify`, `finalize`          | Observe behavior and clean up the current task               |
| `scaffold-slice`              | Complete model/DTO/Nest/React feature work                   |
| `record-demo`, `produce-demo` | Local recordings and finished demonstration videos           |

Keep multi-session scratch plans under ignored `.agents/work/`. No mandatory
PR ceremony, ADR workflow, tickets, delegation or publishing is introduced.

## Local demonstration tools

Run commands from the root:

```sh
pnpm demo:install
pnpm demo:record doctor
pnpm demo:produce doctor
pnpm demo:test
```

Playwright is a root dev dependency. `demo:install` downloads Chromium into ignored
`node_modules/.cache/ms-playwright`. FFmpeg/libx264 is a machine prerequisite for
MP4 production. Recording needs a running local app and a real display (or Xvfb).

Recordings, step logs, screenshots, storyboards, drafts, final renders, posters,
chapter lists and review sheets stay beneath root `demos/`. No asset host or upload
is involved. Generated media/build data is ignored; useful TypeScript take scripts
and storyboards can be committed. See `demos/README.md` and the two demo skills.

`.agents/record-demo.ts` configures the recorder; `.agents/produce-demo.ts` supplies
DWC styling without inherited logos, accounts or domains. They have no login hook
until real auth/seed accounts exist. Do not freeze the browser clock for auctions.
The producer checks the encoded video's five-minute limit; draft and final output
names differ to preserve both.

The recording/production engines are preserved upstream JavaScript/Shell utilities,
with source hashes in `.agents/skills/upstream.json` and credits in
`.agents/skills/NOTICE.md`. Only those vendored utilities are excluded from authored
lint/format checks; DWC's TypeScript adapters are linted and typechecked. Existing
upstream rendering tests run through `demo:test`.

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

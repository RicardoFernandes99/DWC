---
name: record-demo
description: Record DWC browser walkthroughs or visual evidence with cursor, highlights and captions, saving videos and step screenshots locally under demos/.
license: MIT
metadata:
  version: '1.6.0'
---

# Record a demo

Use real browser interactions with seeded/demo data. Read `apps/web/AGENTS.md`.
Save takes under **`demos/takes/` in this repository** and return local file paths.
Current pages are public; real
seeded-account login can be added to `.agents/record-demo.ts` once auth exists.
Do not add an authentication bypass or pretend future features work.

## Setup

Run `pnpm demo:record doctor`. Playwright is a root development dependency.
Install its browser with `pnpm demo:install`. FFmpeg with libx264 is needed for
MP4 and usable WebM duration headers; doctor checks it. A real display is needed
for tab capture (on displayless Linux use Xvfb). Start the local app and record its
localhost URL. The doctor diagnoses setup; a real take proves capture works.

The TypeScript entry point applies the local project configuration and enforces
output paths under `demos/`. Vendored runtime files are listed in `../upstream.json`.

## Workflow

1. Define the flow and selectors from the actual app. Start with one short take.
2. Preview the commands under `DEMO_PREVIEW=1`; read every generated step image.
3. Record without that flag, finish, inspect stills and play the video for pacing.
4. Return the local video and note any limits. `produce-demo` assembles several takes.

Commands run from the root:

```sh
pnpm demo:record start demos/takes/catalogue.webm http://localhost:5173 h1
pnpm demo:record caption 'Browse local products' 3000
pnpm demo:record highlight main 2000
pnpm demo:record finish --mp4
```

For repeated takes write a TypeScript script under `demos/scripts/` that spawns
`node .agents/skills/record-demo/scripts/record-demo.ts` with argument arrays;
abort in a `finally` block if recording fails. Avoid shell interpolation of copy.

Read [commands.md](references/commands.md) for selectors, navigation, captions,
cuts and preview behavior; [troubleshooting.md](references/troubleshooting.md)
for capture failures. Every take writes `<name>.record-demo/steps.jsonl` and
step PNGs beside the video. Failed takes preserve a partial recording and image.

For a produced video set `DEMO_CAPTIONS=log` while recording so captions are
composited outside the footage. Keep the default 1440x900 at 2x. Record scenes
sequentially. Do not use `DEMO_NOW` for auctions: the browser clock must remain
consistent with the API's live deadline. Seed repeatable state without freezing
server-authoritative behavior. Recordings are evidence, not a substitute for
API authorization or focused concurrent-bid checks.

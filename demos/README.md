# Local demos

All demo artifacts stay in this project and are delivered as local file paths.
Rendering uses Geist and Geist Mono from Google Fonts, with system-font fallback offline.

- `scripts/`: authored TypeScript take scripts (commit when useful).
- `takes/`: raw WebM/MP4 clips and `.record-demo/` screenshots/logs (ignored).
- `<name>.storyboard.json`: repeatable video storyboards (commit when useful).
- `<name>.draft.mp4` / `<name>.mp4`: draft and final renders (ignored).
- `*.produce-demo/` / `*.review/`: posters, chapters, build data and review sheets (ignored).

From the repository root:

```sh
pnpm demo:install
pnpm demo:record doctor
pnpm demo:produce doctor
```

Start the web app before recording. Use `pnpm demo:record` and
`pnpm demo:produce` as described in their skills. Videos use local demo data;
authenticated flows need real seeded-account sign-in once authentication exists.
The assignment limit is five minutes, including cards and transitions.

Playwright/Chromium is local to `node_modules/.cache/ms-playwright`; reinstall the
browser after deleting node_modules. FFmpeg with libx264 must be installed on the
machine for MP4 production. The demo engines are vendored JavaScript/Shell tools;
DWC configuration and adapters are TypeScript. The project adapters confine output
to this folder. Do not call upstream engine files directly.

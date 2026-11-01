---
name: produce-demo
description: Assemble local DWC demo recordings into a captioned video with title and chapter cards, then review the result and save everything under demos/.
license: MIT
metadata:
  version: '1.1.0'
---

# Produce a demo video

Use `record-demo` takes to explain a real implemented flow. Save storyboards,
footage, drafts, final videos, posters, chapter lists and review sheets beneath
**root `demos/`**. Deliver the local MP4 and related local file paths directly.

The project look lives in `.agents/produce-demo.ts`; the recorder shares its
colors through `.agents/record-demo.ts`. Use DWC names and local seeded data.
Only show features actually implemented. Keep the final assignment video at or
below five minutes including cards/transitions; aim around 4:30 to leave margin.

## Setup

Run `pnpm demo:produce doctor`. It checks Playwright/Chromium, FFmpeg/libx264,
filters and branding. Run `pnpm demo:install` for the browser. Rendering uses
Geist and Geist Mono from Google Fonts, with system-font fallback offline.
A local font file can be configured when needed.
Music is disabled by default. Vendored scripts and the shared HTML renderer
retain their license in `../shared/LICENSE`.

## Workflow

1. Write `demos/<name>.storyboard.json` using [storyboard.md](references/storyboard.md).
   Choose chapters from the requested story rather than a formal approval workflow.
2. Record takes under `demos/takes/` with `DEMO_CAPTIONS=log`. Preview selectors
   first, retain the default 1440x900 at 2x and record sequentially. Highlight
   rather than zoom so full scenes fit the producer's frame.
3. Run `pnpm demo:produce lint demos/<name>.storyboard.json`. Fix errors and
   unreadably fast captions. A missing take is expected only before filming.
4. Run `pnpm demo:produce build demos/<name>.storyboard.json --draft`.
   Drafts use `<name>.draft.mp4`; final builds use `<name>.mp4`.
5. Review the draft, adjust story/copy/pacing and build without `--draft`.
6. Run `pnpm demo:produce review demos/<name>.mp4`, inspect every contact sheet
   against [review.md](references/review-rubric.md), and fix/rebuild if needed.
7. Return the local MP4 and useful poster/review/chapters paths. The wrapper
   fails a build over 300 seconds while retaining the local video for revision.
   Chapter notes link directly to the local video and poster.

An optional local preview editor is `pnpm demo:produce studio demos/<name>.storyboard.json`.
It is not required for simple videos. No synthetic narration or music is needed;
use concise English captions and real app behavior. A demonstration cannot prove
bid concurrency; record any focused behavior checks separately from the footage.

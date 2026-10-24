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
**root `demos/`**. Deliver local paths. No uploads or external asset service.

The project look lives in `.agents/produce-demo.ts`; the recorder shares its
colors through `.agents/record-demo.ts`. Use DWC names and local seeded data.
Only show features actually implemented. Keep the final assignment video at or
below five minutes including cards/transitions; aim around 4:30 to leave margin.

## Setup

Run `pnpm demo:produce doctor`. It checks Playwright/Chromium, FFmpeg/libx264,
filters and branding. Run `pnpm demo:install` for the browser. The default font
requests Geist from Google Fonts, falling back to system fonts offline; a local
licensed font path in the brand file makes typography reproducible offline.
Music is disabled by default. Supporting upstream scripts and the shared HTML
renderer are included with attribution in `../NOTICE.md`.

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
   Chapter notes link to the local video and poster; no public URL is required.

An optional local preview editor is `pnpm demo:produce studio demos/<name>.storyboard.json`.
It is not required for simple videos. No synthetic narration or music is needed;
use concise English captions and real app behavior. A demonstration cannot prove
bid concurrency; keep actual automated checks separate from the footage.

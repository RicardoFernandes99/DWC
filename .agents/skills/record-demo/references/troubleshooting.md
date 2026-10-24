# Recording failures

- Run `pnpm demo:record doctor`; install Chromium with `pnpm demo:install`.
- Tab capture needs a headed browser and secure context (localhost or HTTPS).
  On Linux without a display, wrap the take script in Xvfb.
- If a click times out, inspect `failure.png` for an overlay intercepting it.
  Confirm the selector matches the intended visible control before changing waits.
- A failed command saves a partial take and its step log. Abort the owned session
  before trying a new take; never kill unrelated browser/server processes.
- A Unix socket path can be too long. `DEMO_STATE` may name a short user-owned
  temporary state file. This is control state, not video output.
- FFmpeg with libx264 is required for MP4; Playwright's bundled FFmpeg cannot
  replace a full installation. Without it keep the WebM and report the limitation.
- A blank or wrongly framed capture needs a short real take, not just a passing
  preview. Check stills and the final video before claiming a recording succeeded.

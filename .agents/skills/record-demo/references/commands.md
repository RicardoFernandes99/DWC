# Recording commands

Prefix each command with `pnpm demo:record` from the repository root.

| Command                                              | Behavior                                          |
| ---------------------------------------------------- | ------------------------------------------------- |
| `start demos/takes/name.webm [url] [ready-selector]` | Open, apply optional real login hook, then record |
| `goto <url> [ready-selector]`                        | Navigate; wait for actual loaded content          |
| `move <selector> [ms]`                               | Move the drawn cursor                             |
| `click <selector> [settle-ms]`                       | Move and perform a real click                     |
| `drag <from> <to-or-@dx,dy> [settle-ms]`             | Real pointer drag                                 |
| `type <selector> <text> [settle-ms]`                 | Type visible demo text                            |
| `press <key> [settle-ms]`                            | Enter, Tab, Escape or another key                 |
| `highlight <selector> [ms]`                          | Emphasize a region                                |
| `caption <text> [ms]`                                | Show/log a caption                                |
| `callout <selector> <text> [ms]`                     | Point a label at a control                        |
| `pause <ms>`                                         | Hold the frame                                    |
| `cut` / `resume`                                     | Omit setup/loading time from the take             |
| `zoom [selector] [factor]` / `unzoom`                | Optional detail shot; avoid for produced videos   |
| `finish [--mp4]`                                     | Save locally and close the owned browser          |
| `abort`                                              | Preserve the partial take and close it            |

Selectors use Playwright's syntax. Scope text by row/container: selectors resolve
the first match. Qualify `:has-text()` with a tag; a broad match can film the wrong
ancestor. Pass a readiness selector for pages loading data asynchronously. Show
menus/dialogs opening and closing on camera; use a predictable trigger and verify
which layer a dismissal closes.

`DEMO_PREVIEW=1` runs headless and generates screenshots/logs under a separate
`preview/` subfolder without replacing filmed evidence. `DEMO_CAPTIONS=log`
records caption timing for the producer rather than drawing words into footage;
captions do not pause actions in that mode, so allow reading time.

Use `DEMO_WEB_URL` for another local port and a distinct `DEMO_STATE` socket/state
path for independent preview sessions. Captures themselves run sequentially.
Never type secrets on camera; use demo credentials and avoid recording login if
it is not part of the requested flow. No footage leaves `demos/` automatically.

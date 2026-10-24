# Local storyboard

Paths in `take` are relative to the storyboard. Use the file returned by
`finish` (`.mp4` with `--mp4`, otherwise the finalized/remuxed `.webm`); the raw
WebM left beside an MP4 can lack duration metadata. Each take needs the matching
`.record-demo/steps.jsonl`, filmed with `DEMO_CAPTIONS=log`.

```json
{
  "title": "From farm to table",
  "eyebrow": "DWC demonstration",
  "subtitle": "Find products from local producers",
  "audience": "internal",
  "host": "",
  "chapters": [
    {
      "label": "Catalogue",
      "title": "Find local products",
      "summary": "Filter the catalogue and open a product.",
      "take": "takes/catalogue.webm"
    }
  ],
  "end": { "note": "Recorded with local demo data" }
}
```

This is a future feature example, not evidence that catalogue behavior exists.
Choose actual routes/screens from the implemented app.

Required fields: nonempty `title` and `chapters`, with each chapter's `label`,
`title` and `take`. Optional chapter `summary` and `copy` (a map from logged caption
text to corrected copy). `take` can be a list of consecutive clips. Optional top
fields: `eyebrow`, `subtitle`, `chips` (up to four), `audience` (`internal`/`client`),
`product`, `host`, `intro`, `recap`, `end`. Keep `host` empty to show paths only.

`recap` is optional: `title`, three `columns`, and triple-valued `rows`.
`end` accepts `title`, `link`, `note`; no public link is required. For a product
walkthrough there is no need for a before/after recap.

Captions and callouts come from the take logs, not a second timestamp list.
In log mode captions don't hold the take; leave enough reading time through
following actions/pauses. Use one idea per caption and plain English. Cards
have computed lengths, so budget their time as well as footage. Keep total video
under five minutes; the wrapper checks the encoded output duration.

Builds default beside the storyboard. `--out demos/final/name.mp4` selects another
local path. All inputs and outputs used by the entry point remain under `demos/`.

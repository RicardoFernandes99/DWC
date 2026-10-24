# Skill adaptation credits

Adapted for DWC from the local Pixelmatters/agensight repository at revision
`ac0faa2dc` on 2026-10-24. Only this DWC copy is customized. Source metadata
identifies the following skills as MIT-licensed:

- `nestjs-best-practices`: Kadajett, `kadajett/agent-nestjs-skills`, version 1.1.0.
  DWC's entry point and references are rewritten for Mongoose.
- `design-engineering`: Pixelmatters, version 2.2.0. The source component reference
  credits Vercel's React composition patterns (MIT); DWC retains general composition
  guidance with its own focused references.
- `record-demo`: Pixelmatters, version 1.6.0.
- `produce-demo`: Pixelmatters, version 1.1.0.
- `plan`, `grill-me`, `scaffold-slice`: Agensight-inspired, rewritten as lightweight
  chat planning, question resolution and feature guidance. No upstream planning
  renderer, ticket integration or ADR process is included.

The demo engines (including their tests), overlay, and shared HTML helper are
vendored here. DWC adapts three runtime files to generate local video/poster links
and remove upload prompts. `upstream.json` records current hashes and original
hashes for adapted files.
DWC's TypeScript adapters, configuration and rewritten guides are maintained here.
Names/domains in unmodified upstream test fixtures or optional driver diagnostics
are test data/unused capabilities, not DWC integration requirements.

## Animation skill

`animate` adapts [Emil Kowalski’s animate skill](https://github.com/emilkowalski/skills/tree/2d228630ba1446365f614a108cb8252f1feda202/skills/animate)
from `emilkowalski/skills` at revision `2d228630ba1446365f614a108cb8252f1feda202`.
Copyright (c) 2026 Emil Kowalski, MIT licensed; the full upstream notice is retained
in `animate/LICENSE`. DWC adds a short entry point and adapts the principles and
recipes for React Compiler, existing shadcn/ReUI primitives, accessibility, and
CSS-first motion. No unrelated animation/review/library-picker skills are required.

## MIT license notice

Copyright belongs to the respective authors credited above. Preserve their notices
and this attribution when redistributing these adapted skills and utilities.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

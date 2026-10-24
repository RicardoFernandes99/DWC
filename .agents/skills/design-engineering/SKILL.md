---
name: design-engineering
description: Build or refine DWC React components, accessible forms, responsive layouts, interaction states, and visual polish with shadcn/ReUI and React Compiler.
---

# Design engineering

Read `apps/web/AGENTS.md` for library and compiler choices. Inspect existing
components before adding new ones. Work within the existing tokens and primitives.

- [Components](references/components.md): composition and state ownership.
- [Forms](references/forms.md): submissions and field/server feedback.
- [Accessibility](references/accessibility.md): touch, keyboard and responsive UI.
- [Motion and loading](references/motion-and-loading.md): stable layout and feedback.

Build the smallest component that supports the interaction; stock, totals and bid
outcomes remain server-authoritative. Use `web-feature` for implementation checks.

---
name: animate
description: Add or refine purposeful DWC interface animations, transitions, easing, timing, and interruption behavior using Emil Kowalski’s animation principles.
license: MIT
metadata:
  author: Emil Kowalski; adapted for DWC
---

# Animate

Read `apps/web/AGENTS.md` and inspect the existing component and motion tokens.
This skill adds motion to an actual interaction; `design-engineering` covers
broader layout, composition and accessibility.

- Decide whether motion helps and name its purpose: feedback, spatial continuity
  or a clearer state change. Frequent interactions should feel immediate. Do not
  animate stock, prices, bid results or countdowns in a way that hides current data.
- Start with CSS transitions/animations and existing shadcn/ReUI behavior. Use
  WAAPI when programmatic control is useful. Add Motion only for an actual
  spring/gesture/layout/exit requirement; it is not currently a dependency.
- Reuse timing/easing tokens and prefer transform/opacity. Read
  [principles.md](references/principles.md) for Emil’s timing/curve tables,
  interruption, origin and gesture guidance; read [RECIPES.md](RECIPES.md) for
  the matching pattern. Adapt the recipe rather than adding an animation system.
- Preserve primitive focus, presence and dismissal behavior. Keep React Compiler
  purity/hook rules; do not add routine memoization or an effect solely to mark
  a component mounted for an entrance animation.
- Include reduced-motion and touch/hover behavior. Rapid re-triggering should
  continue naturally from the current visual state, not jump back to the start.
- Exercise the changed interaction in the browser: normal and reduced motion,
  keyboard/touch as applicable, repeated activation, interruption and exit. Use
  the feature’s existing checks and keep the final explanation brief. Do not
  require a separate animation audit, review skill or demo for every small change.

Use animation only for implemented behavior; a success effect waits for the server
outcome. This skill does not change the UI just by being installed.

# 045: Establish shared UI tokens, primitives and a visual style specimen

- Macro: M01, M03 shared UI foundation
- Status: Draft
- Depends on: None
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None; build before 004 and subsequent feature screens

## Outcome

Feature builders have one visual example and one theme source to follow, with
organized reusable controls and typed component APIs.

## Read first

[UI guidelines](../ui-guidelines.md), [web guidance](../../apps/web/AGENTS.md),
`apps/web/src/index.css`, `apps/web/src/components/ui/button.tsx`,
`apps/web/components.json` and `design-engineering`.

## Scope and contract

- Keep `src/index.css` as the canonical semantic token/Tailwind mapping source.
  Use the existing green/neutral direction and document any necessary adjustments.
  Components consume token utilities, not copied color values or a second theme map.
- Keep shadcn/ReUI primitives in `src/components/ui`. Add only controls used by the
  specimen/upcoming auth forms, with typed native props/CVA variants. Preserve the
  configured Radix-based stack; do not introduce a parallel Base UI library.
- Add `src/design-system` specimen using the real colors, typography, buttons,
  fields, cards and focus/disabled/error examples. Keep it small and locally
  accessible through a development-only entry in the current app; no router or
  Storybook dependency solely to show the specimen.
- Repeated project patterns belong in typed `components/shared` components when
  real reuse arises. Feature-only composition stays in its feature folder.
- Ticket 004 retains local access when it introduces routing, for example through
  a development-only style-guide route. Do not ship a fake marketplace as preview.

## Acceptance criteria

- [ ] Specimen and existing controls visibly share the same semantic tokens.
- [ ] Primary/secondary/destructive/disabled/focus and form-error examples are legible.
- [ ] Primitives use consistent typed props and the documented folder structure.
- [ ] No duplicate theme, framework, premature generic component engine or Storybook.
- [ ] Local preview works with keyboard and all three responsive ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification). Manually
inspect the specimen and its focus/error states. No UI test suite is required.

## Delivery notes

Not implemented. ID 045 was added after the domain tickets; dependencies determine
its early place in the build order. Record actual evidence and PR metadata here.

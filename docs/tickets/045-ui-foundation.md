# 045: Establish shared UI tokens, primitives and a visual style specimen

- Macro: M01, M03 shared UI foundation
- Status: In progress
- Depends on: None
- PR: Not opened
- Branch / parent: `codex/age-045-ui-foundation` / `codex/age-003-auth-sessions-api` at `92f5265cb52a99ef5126332c9f2d85906fb5059c`
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

- [x] Specimen and existing controls visibly share the same semantic tokens.
- [x] Primary/secondary/destructive/disabled/focus and form-error examples are legible.
- [x] Primitives use consistent typed props and the documented folder structure.
- [x] No duplicate theme, framework, premature generic component engine or Storybook.
- [x] Local preview works with keyboard and all three responsive ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification). Manually
inspect the specimen and its focus/error states. No UI test suite is required.

## Delivery notes

Implemented on 2026-11-01. The development-only `/?style-guide` entry displays
the real semantic tokens, typography, spacing/radii, button variants, labelled
inputs, cards and feedback. Input, Label and Card primitives use typed props.
The production build excludes the specimen module; no dependencies were added.

- Builder: `gpt-6.1-terra`, medium effort. No model adaptations or correction rounds.
- Usage and accepted-work cost measurements: unavailable.
- Parent: PR #9, commit `92f5265cb52a99ef5126332c9f2d85906fb5059c`.
- Frontier verdict: APPROVED. Reviewed the ticket-only source diff and new files.
- Builder checks passed under Node 24.22.1: web typecheck, production build and
  React Compiler verification, root lint, scoped Prettier, and both existing web tests.
- Orchestrator checked the specimen in Codex's in-app browser at 390px, 900px
  and 1440px. No horizontal overflow; fields/cards adapt, keyboard focus and
  error states are visible, and disabled button/input controls remain disabled.
- Local verification used port 5175 after a stalled server on 5173 was stopped.
  The normal development command still uses 5173.
- No application limitations identified. PR publication pending.

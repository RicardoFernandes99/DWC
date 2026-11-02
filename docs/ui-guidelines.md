# Frontend style and component conventions

Use this reference for every React UI ticket. The visual specimen will be built
in [045: UI foundation](tickets/045-ui-foundation.md). Follow the approved
Orchard direction shown at `/ui-design` and in the durable reference asset at
`apps/web/public/design/orchard-reference.png`.

## Tokens

`apps/web/src/index.css` is the canonical theme source. Its `:root` variables and
Tailwind `@theme inline` mapping already define background, foreground, primary,
secondary, muted, accent, card, border, input, ring and feedback colors, plus radii.

The approved Orchard palette is Forest `#24563D` for primary actions, Cream
`#F7F5EE` for the page and auth background, Sage `#DDE8D8` for secondary
surfaces, Ink `#253329` for text and icons, and Orange `#D98145` for highlights
and warning surfaces. Orange uses Ink text because white-on-orange does not meet
text contrast. Destructive feedback stays red; Orange does not replace it.
Continue using Fraunces for editorial headings and the system font for controls
and body text.

Components consume semantic classes such as `bg-primary`, `text-foreground`,
`text-muted-foreground`, `border-border` and `ring-ring`. They must not copy color
values into component files or create a competing TypeScript color map. A needed
new semantic token belongs in that central source and the visual specimen.

Current visual defaults include cream backgrounds, forest primary actions, sage
secondary surfaces and semantic success/warning/error feedback. Keep typography, spacing,
radii and control variants consistent with the specimen. Do not add a new font,
dark theme or styling framework solely to decorate one screen.

## Folders and reuse

| Location                             | Responsibility                                                            |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `src/components/ui/`                 | Shared shadcn/ReUI primitives such as buttons, inputs, dialogs and badges |
| `src/components/shared/`             | Repeated project patterns composed from primitives, with typed props      |
| `src/features/<feature>/components/` | Components owned by one feature; no global abstractions without consumers |
| `src/design-system/`                 | Development-only visual specimen and its example data                     |
| Router's route files                 | Page composition, typed navigation and route boundaries                   |
| `src/lib/`                           | HTTP/session utilities, `cn` and other actual shared non-visual helpers   |

The selected stack is shadcn/ui and ReUI with Radix underneath. Do not add a
parallel Base UI or other primitive framework incidentally. Registry output belongs
in the configured UI folder, not scattered through feature pages.

If markup/behavior will be used or maintained in multiple places, give it a real
component with explicit TypeScript props instead of copying it. Examples include
form-field wrappers, approval/suspension banners and order-status presentation.
Keep feature-only composition local until there is a real second consumer.

Use CVA/discriminated variants, children/slots and appropriate native props rather
than long boolean prop lists. Extend existing primitives before inventing another
button/input. Preserve focus, labels, ref/native behavior and button/link semantics.
Do not add a generic schema-to-form engine, premature component package or Storybook
requirement. React Compiler remains enabled; no routine manual memoization.

## Visual specimen

The specimen uses actual primitives/tokens so it changes with the app. Include
color swatches with semantic names, typography, spacing/radii, button variants,
labelled form controls, focus/disabled/error states, cards and feedback examples.
Use only example data; it is not a pretend catalogue or admin implementation.

Add reusable patterns to it as real features introduce them. Confirm visual
changes there before repeating them across pages. The specimen must remain
available locally after the auth router replaces the starter screen.

## Responsive and interaction checks

All screens adapt below 768px, at 768-1279px and at 1280px upward. The two/three/four
column rule belongs to product grids, not every form or page. Keep labels, visible
focus, comfortable targets, reduced motion and explicit loading/empty/error states.
Use a quick manual browser check plus typecheck/lint/build; no snapshot or visual
regression test suite is required for this university project.

Run `pnpm --filter @dwc/web dev` and open `/?style-guide` to view the specimen locally. The entry is excluded from production builds.

## Authentication screens

Login and registration use a warm neutral form surface and a countryside image
panel on tablet and desktop. On mobile, the image panel gives way to a single
form column. Fraunces is self-hosted for editorial headings; controls retain the
existing system font and semantic green palette. Theme values and auth styles
remain in `apps/web/src/index.css`.

The countryside photograph is from
[Unsplash](https://images.unsplash.com/photo-1500382017468-9049fed747ef), stored
locally under `apps/web/public/images`. Fraunces is distributed under the SIL Open
Font License, included with the font under `apps/web/public/fonts`.

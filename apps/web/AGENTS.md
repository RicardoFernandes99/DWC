# Web instructions

Read root `AGENTS.md` and `docs/project-scope.md`. Package: `@dwc/web`.

## Stack and library choices

| Area                      | Choice                                             | Status                                              |
| ------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Application               | React + strict TypeScript + Vite SPA               | Installed                                           |
| Optimization              | React Compiler and React Hooks/compiler lint rules | Enabled                                             |
| Styling                   | Tailwind CSS, semantic tokens, CVA and `cn`        | Installed                                           |
| Components                | shadcn/ui and ReUI, Radix underneath               | Registry configured; add components as needed       |
| Icons                     | Lucide React                                       | Installed                                           |
| Routing                   | TanStack Router                                    | Preferred when routes are implemented               |
| Server state              | TanStack Query                                     | Preferred when data-driven features are implemented |
| Forms                     | TanStack Form                                      | Preferred for nontrivial forms when implemented     |
| Unit/interaction testing  | Vitest + Testing Library                           | Installed                                           |
| Browser testing and demos | Playwright + Chromium                              | Playwright at root; install Chromium separately     |
| HTTP mocks                | MSW                                                | Add when repeatable HTTP-level mocks are needed     |

Preferred choices do not imply integrations already exist. Add them with their
first consumer. Avoid parallel routing, server-state, form or component frameworks.
Read `design-engineering` for UI details, `animate` for deliberate motion, and
`web-feature` for implementation.

## React and components

- Preserve `reactCompilerPreset`, its Vite/Babel integration and recommended-latest
  React Hooks rules. Follow purity, immutable updates, hook and effect rules;
  do not disable compiler diagnostics to silence failures.
- Derive values during render; effects synchronize external systems. Do not add
  `memo`, `useMemo`, `useCallback`, or `use no memo` by default. Use them only for
  a concrete compatibility/correctness requirement or measured issue, and explain.
- Reuse `src/components/ui`, `cn`, and semantic CSS tokens. Match the Orchard
  aesthetic with standard rounded components (`rounded-lg` / `rounded-md`) consistent
  with catalogue filters, product cards, and header; avoid arbitrary pill or sharp-corner
  divergences unless specified. Prefer composition and explicit variants over many boolean props.
  Keep state near its consumers.
- Read `docs/ui-guidelines.md` and reuse the design-system specimen once 045 is
  implemented. `src/index.css` owns theme values; consume semantic utilities.
  Keep primitives in `components/ui`, repeated project patterns in
  `components/shared` (e.g. `@/components/shared/product-card.tsx`), shared formatters/constants
  in `src/lib/` (e.g. `@/lib/format.ts`), and feature-only components with their feature. Repeated
  controls/behavior deserve typed props rather than copied markup.
- Use shadcn/ReUI rather than parallel direct Radix application components.
  Registry commands run in `apps/web`; inspect generated code and dependencies.
  Example: `pnpm dlx shadcn@4.22.0 add @reui/rating`. Do not copy whole dashboards.
- Keep `rsc: false`; this is a client SPA, not a Next.js app.

## Routes, data and forms

- When routing is introduced, use typed TanStack Router navigation. Validate path
  and search values. Keep shareable catalogue filters/sorting/pagination in the URL;
  do not duplicate URL state in local state.
- When Query is adopted, centralize query keys/options. Invalidate relevant keys
  after accepted mutations. Distinguish initial loading from background refresh;
  indicate refresh failure when cached data may be stale.
- Keep remote data in Query, not mirrored into another store. Keep transient UI
  state local. Reset user-scoped caches on sign-out once authentication exists.
- Use semantic forms and appropriate autocomplete. With TanStack Form, share field
  wrappers for labels, errors and descriptions; avoid a speculative form engine.
- Pending submissions prevent duplicate requests; rejection restores controls and
  preserves entered data. Put server field errors near the relevant inputs.
- Centralize `/api/...` calls through a small shared HTTP client using Vite's proxy.
  Normalize errors there; keep authentication handling out of individual views.
  Swagger/OpenAPI defines the boundary. Rely on OpenAPI-generated types and typed
  request helpers (`authenticatedRequest<T>`, `publicRequest<T>`). Do not write redundant,
  50-line field-by-field runtime validator type guards for responses already typed by OpenAPI schema.
  Keep parsing of `localStorage` data (e.g. cart items) focused, safe, and lightweight
  (bounded arrays, valid IDs, positive integer quantities). Do not invent backend success.
- For cart and checkout errors, distinctly style out-of-stock items ("Out of stock" /
  "Only X available") without clearing the cart. Surface price change conflicts (409)
  with an inline prompt to review updated totals.

## UX, security and real-time state

- Mobile-first layout, semantic HTML, labelled controls, keyboard access, visible
  focus and explicit loading/error/empty/success states. Copy stays in English.
- Make every screen responsive across three ranges: below 768px with base
  styles, 768px to below 1280px with `md:`, and 1280px upward with `xl:`.
  Adapt navigation, forms, cart, orders and other layouts to the available space;
  the two, three and four column rule applies specifically to product grids.
  Use Tailwind; do not introduce SASS. Check every changed screen in all three
  ranges, including intermediate widths, for overflow and usable controls.
- Reserve image dimensions and async-content space; use tabular numerals for
  changing numbers. Respect reduced motion and label icon-only actions.
- The API owns permissions, prices, stock, order transitions and accepted bids.
  A client guard or disabled button is presentation, not authorization.
- Clean up timers/listeners/socket subscriptions. After reconnect fetch a server
  snapshot. A countdown displays the server deadline; it never accepts a bid.
- Browser variables are public: no S3 credentials or JWT signing secrets. Declare
  and validate new public configuration deliberately.

## Checks

Run web `typecheck` and `build` via `pnpm --filter @dwc/web`, plus root lint and
scoped formatting checks. The build verifies compiler output. Exercise the changed
flow briefly in a browser, including responsive/keyboard behavior and a meaningful
failure. Automated tests are optional; add only small tests with clear value.
No per-feature e2e suite is required. Checks are part of
implementation, not a separate workflow stage. Use the demo skills when visual
evidence is wanted, saving results under root `demos/`.

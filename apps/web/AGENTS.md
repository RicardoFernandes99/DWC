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
Read `design-engineering` for UI details and `web-feature` for implementation.

## React and components

- Preserve `reactCompilerPreset`, its Vite/Babel integration and recommended-latest
  React Hooks rules. Follow purity, immutable updates, hook and effect rules;
  do not disable compiler diagnostics to silence failures.
- Derive values during render; effects synchronize external systems. Do not add
  `memo`, `useMemo`, `useCallback`, or `use no memo` by default. Use them only for
  a concrete compatibility/correctness requirement or measured issue, and explain.
- Reuse `src/components/ui`, `cn`, and semantic CSS tokens. Prefer composition and
  explicit variants over many boolean props. Keep state near its consumers.
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
  Swagger/OpenAPI defines the boundary. Do not invent backend success.

## UX, security and real-time state

- Mobile-first layout, semantic HTML, labelled controls, keyboard access, visible
  focus and explicit loading/error/empty/success states. Copy stays in English.
- Reserve image dimensions and async-content space; use tabular numerals for
  changing numbers. Respect reduced motion and label icon-only actions.
- The API owns permissions, prices, stock, order transitions and accepted bids.
  A client guard or disabled button is presentation, not authorization.
- Clean up timers/listeners/socket subscriptions. After reconnect fetch a server
  snapshot. A countdown displays the server deadline; it never accepts a bid.
- Browser variables are public: no S3 credentials or JWT signing secrets. Declare
  and validate new public configuration deliberately.

## Checks

Run web `typecheck`, `test` and `build` via `pnpm --filter @dwc/web`, plus root lint
and formatting checks. The build verifies compiler output. Exercise changed flows
in a browser when useful; mocks prove only client behavior. See `verify` and the
demo skills for repeatable evidence saved under root `demos/`.

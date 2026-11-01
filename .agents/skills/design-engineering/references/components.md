# Components

Compose shadcn/ReUI primitives, semantic tokens, `cn` and explicit CVA variants.
Use `docs/ui-guidelines.md` and the local visual specimen as the style reference.
Keep theme values in `apps/web/src/index.css`, primitives in `components/ui`,
repeated project components in `components/shared` and feature-only composition
with its feature. Reuse typed prop APIs rather than copying repeated controls.
Prefer children/slots over boolean-heavy APIs. Extend an existing control before
creating another one. Pass through appropriate native attributes and ref props
with TypeScript DOM types; preserve semantic button/link and disabled behavior.

Use pure render logic and derived values. Let React Compiler optimize eligible
code; manual memoization is exceptional. Effects synchronize external systems,
not props/query data into duplicate state. Clean up timers/listeners/subscriptions.

Keep local state near consumers. Use context for genuinely shared state rather
than every component. Once adopted, Query owns server data and URL state owns
shareable filters. Extract reusable structures after actual use establishes them;
do not import an entire dashboard or scaffold Storybook for a single feature.

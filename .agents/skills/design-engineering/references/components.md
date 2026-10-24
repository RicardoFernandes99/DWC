# Components

Compose shadcn/ReUI primitives, semantic tokens, `cn` and explicit CVA variants.
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

# Web instructions

- Read the root `AGENTS.md`; package name: `@dwc/web`.
- React + TypeScript + Vite, React Compiler, Tailwind CSS, shadcn/ui and ReUI.
- React Compiler is enabled through `reactCompilerPreset` in Vite. Preserve
  the complete compiler integration and `react-hooks` recommended-latest lint
  rules. Follow React purity, immutability, hook, and effect rules so code is
  eligible for optimization. Do not disable diagnostics to silence a failure.
- Prefer normal components and derived render values. Do not add `memo`,
  `useMemo`, `useCallback`, or `use no memo` by default. Use them only for a
  concrete compatibility/correctness requirement or measured issue, and explain.
- `pnpm --filter @dwc/web build` verifies compiler output as well as compilation.
- Reuse `src/components/ui`, `cn`, and semantic CSS tokens. Use the configured
  ReUI registry for suitable components; do not copy entire example dashboards.
- Use shadcn/ui and ReUI as the application component layer. Radix is an
  underlying accessibility dependency; do not introduce a parallel set of
  direct Radix application components when a shadcn/ReUI component fits.
- Registry commands run in `apps/web`; review generated code and dependencies.
  Example: `pnpm dlx shadcn@4.22.0 add @reui/rating`.
- Keep `rsc: false`: this is a client SPA, not a Next.js app.
- Use mobile-first layouts, semantic HTML, labelled controls, keyboard access,
  visible focus, and explicit loading/error/empty states.
- All UI copy, documentation, and code identifiers are English.
- Request `/api/...` through the dev proxy. Never expose storage credentials or
  future JWT signing secrets in browser variables, code, or logs.
- Keep domain state authoritative on the server. Add client routing/state tools
  when the first actual feature needs them.
- Validate with web typecheck, tests, build, and the root lint command.

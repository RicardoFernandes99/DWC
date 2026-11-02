---
name: web-feature
description: Implement or change React screens, components, forms, and client behavior in apps/web using React Compiler, Tailwind, shadcn/ui, and ReUI.
---

# Web feature

1. Read root/web instructions and `docs/project-scope.md`. Identify the user
   flow, server contract, and acceptance criteria before implementing.
2. Read `design-engineering` for component, form, accessibility and interaction
   guidance. Inspect existing components first. Prefer semantic Tailwind tokens and
   shadcn/ReUI primitives. Check registry source and compatibility before adding
   generated code. Do not introduce another styling framework.
3. Write pure components, immutable state updates, and properly scoped effects.
   Let React Compiler optimize eligible components and hooks. Preserve compiler
   diagnostics; do not add manual memoization as routine boilerplate.
4. For requested motion, use `animate` without adding a library by default.
   Include responsive layouts, accessible controls, keyboard behavior, and
   loading, failure, and empty states. UI copy stays in English.
5. Call the real `/api` contract using OpenAPI-generated `components['schemas']`
   types and typed request helpers (`authenticatedRequest<T>`, `publicRequest<T>`).
   Validate user input and URL search params at boundaries, but do not write
   verbose field-by-field runtime type guards for our own typed NestJS responses.
   Keep parsing of `localStorage` (e.g. cart data) focused, safe, and lightweight
   (bounded arrays, valid IDs, positive integer quantities).
   Keep files focused: follow the Orchard aesthetic with standard rounded styling
   (`rounded-lg` / `rounded-md`), put shared visual components in `src/components/shared/`
   (e.g. `@/components/shared/product-card.tsx`), shared formatters/constants in `src/lib/`
   (e.g. `@/lib/format.ts`), and feature subcomponents in `src/features/<name>/components/`
   rather than monolithic files. Style out-of-stock items distinctly ("Out of stock" /
   "Only X available") without clearing the cart, and surface price change conflicts (409)
   with an inline prompt to review totals. Do not invent backend success, permissions,
   auction outcomes, or stock changes. Clean up subscriptions when introduced.
6. Run typecheck/build, root lint and scoped formatting checks. Briefly exercise
   the interaction, a meaningful failure and responsive/keyboard behavior in a
   browser. Automated tests are optional; add only small tests with clear value.
   The production build must confirm compiler output. Report checks actually performed.
7. Summarize the behavior and validation, including any unimplemented dependency.

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
4. Include responsive layouts, accessible controls, keyboard behavior, and
   loading, failure, and empty states. UI copy stays in English.
5. Call the real `/api` contract. Do not invent backend success, permissions,
   auction outcomes, or stock changes. Clean up subscriptions when introduced.
6. Test the changed interaction and a meaningful failure case. Run web tests,
   typecheck, build, root lint and relevant formatting checks. The production
   build must confirm compiler output. Review the UI in a browser when possible;
   distinguish automated tests from visual checks actually performed.
7. Summarize the behavior and validation, including any unimplemented dependency.

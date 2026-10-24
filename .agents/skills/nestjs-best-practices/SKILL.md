---
name: nestjs-best-practices
description: Design or change DWC NestJS feature modules, dependency injection, HTTP boundaries, Mongoose persistence, and authorization.
---

# NestJS practices

Read `apps/api/AGENTS.md`. Keep a feature-based modular monolith with useful,
explicit responsibilities. Use these references for the area being changed:

- [Architecture](references/architecture.md): modules, DI and layer boundaries.
- [Persistence](references/persistence.md): models, queries and atomic writes.
- [Boundaries](references/boundaries.md): validation, authorization and output.

Use Nest CLI and Mongoose. Do not add another ORM, broker or microservices to
follow an example. Use `api-feature` for implementation checks; verify actual
contention against MongoDB when stock or bid invariants change.

---
name: scaffold-slice
description: Build a DWC feature across its MongoDB model, NestJS API contract and rules, React flow, and meaningful verification.
---

# Build a vertical slice

Read scope and app guidance. Pick the smallest complete user outcome and name its
roles, ownership, success and refusal cases. Inspect real code; the current scaffold
is not a complete business-feature template.

1. Define DTO/OpenAPI requests, responses and failure statuses.
2. Design the Mongoose model, indexes, embedding/references and atomic writes.
   Snapshot order prices/names and establish stock/bid invariants before UI work.
3. Implement a feature module, thin controller and domain service. Add repositories
   where substantial queries/session handling justify them. Enforce real identity.
4. Build the React flow with chosen libraries and existing components, including
   accessible forms and loading/empty/error/success states.
5. Exercise the real API-to-UI path and refusals. Prove concurrency with MongoDB
   and keep related docs accurate.

Use `api-feature`, `web-feature`, `nestjs-best-practices`, `design-engineering`
and `verify` for detail. Install preferred libraries with their first consumer.
Keep Laravel administration for its own requested feature. Don't generate empty
layers/endpoints/pages just to complete a directory tree.

---
name: scaffold-slice
description: Build a small complete DWC feature from its MongoDB model and NestJS API through the React UI, using existing patterns and proportionate checks.
---

# Build a complete feature

Read scope, affected app guidance and nearby code. State the user outcome and
important refusals; use a few inline `plan` bullets if the change is substantial.
Use `grill-me` only for a meaningful open decision, not routine scaffolding.

- Define the needed model/DTO/OpenAPI boundary and ownership rules. Choose
  embedding, references and indexes from actual queries; establish atomic
  stock/bid rules before making UI promises.
- Implement the Nest endpoint and domain behavior using `api-feature`. Add a
  repository only where queries/session handling justify it.
- Build the corresponding React flow using `web-feature` and existing components.
  Add routing/forms/query dependencies only with a real consumer. Include useful
  loading, empty and error states; show success only after the API accepts it.
- Exercise the complete path and a meaningful refusal. Use real MongoDB for
  concurrency guarantees, and update the relevant existing docs when needed.

Follow working examples in this repo; the health scaffold is not a full business
feature template. Create only files the feature uses. No generic CRUD generator,
empty future layers, ticket system, plan files, phase handoffs or separate review/
verification/delivery skills. Summarize the result and checks briefly.

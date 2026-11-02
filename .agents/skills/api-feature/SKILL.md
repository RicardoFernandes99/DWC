---
name: api-feature
description: Implement or modify NestJS REST endpoints, DTOs, MongoDB models, S3 operations, and future real-time auction behavior in apps/api.
---

# API feature

1. Read root/API instructions, scope, and architecture. Establish resource
   ownership, allowed roles, request/response shape, and failure cases.
2. Read `nestjs-best-practices` for module, persistence and boundary guidance.
   Implement modules, thin controllers, validated DTOs and domain services.
   Reject unexpected input and use appropriate HTTP status codes.
3. Choose embedding/references intentionally. Snapshot order item names and
   prices when order models are introduced. Add indexes based on real queries.
4. Enforce identities and ownership on the server. Never trust caller-supplied
   roles, monetary totals, auction deadlines, or stock availability.
5. For atomic checkout and auctions, make conditional atomic updates the acceptance
   boundary; execute mixed order/stock/payment writes inside a real MongoDB session
   transaction (`withTransaction`). Use conditional stock decrements (`availableStock: { $gte: quantity }`)
   and abort on any item refusal. Validate quote fingerprints against live DB state and return
   `409 Conflict` on price/fee shifts. Scope idempotency per buyer. Broadcast or publish
   side effects only after persistence succeeds.
6. Keep S3 buckets private and SDK configuration provider-neutral. Define access
   control before adding uploads or signed URLs; validate file size and type.
7. Update Swagger with DTO schemas and success/error responses. Export the web contract
   (`pnpm contract:generate`) when endpoints or DTOs change so OpenAPI types are cleanly exposed to `@dwc/web`.
   Keep liveness separate from dependency readiness; failures must not disclose secrets.
8. Run API typecheck/build and root lint/scoped format checks. Manually exercise
   the changed endpoint and a meaningful refusal. Automated tests and smoke are
   optional; choose a small focused check only when useful. Use isolated data and
   remove only records/objects created by the check. Do not build a test suite by default.

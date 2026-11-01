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
5. For auctions, make conditional atomic updates the acceptance boundary;
   exercise simultaneous bids with separate clients. Consider a transaction for
   consistent auction/bid records. Broadcast only after persistence succeeds.
6. Keep S3 buckets private and SDK configuration provider-neutral. Define access
   control before adding uploads or signed URLs; validate file size and type.
7. Update Swagger with DTO schemas and success/error responses. Keep liveness
   separate from dependency readiness; failures must not disclose secrets.
8. Run API typecheck/build and root lint/scoped format checks. Manually exercise
   the changed endpoint and a meaningful refusal. Automated tests and smoke are
   optional; choose a small focused check only when useful. Use isolated data and
   remove only records/objects created by the check. Do not build a test suite by default.

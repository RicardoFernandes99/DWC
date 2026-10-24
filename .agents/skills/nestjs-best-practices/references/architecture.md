# API architecture

A feature owns its controller, DTOs, schemas, services and any repositories it
needs. Group by business capability and avoid scaffolding empty future domains.

| Layer                   | Responsibility                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Controller              | HTTP input, guards, service calls and documented response mapping; no model queries |
| Service                 | Domain invariants, ownership and work coordination                                  |
| Repository, when useful | Feature-specific filters, projections, atomic/session-aware queries                 |
| Module                  | Own providers, explicit imports and a narrow exported API                           |

Don't re-provide another module's service; this can create a separate instance.
Prefer constructor injection and singleton stateless providers. Request scope
needs an actual context requirement. Avoid service location or `forwardRef` as
default designs. Shared providers need real consumers, not anticipated reuse.

Use intent-named query methods, not a generic base CRUD layer. A helper used only
inside one aggregate can stay there. Cross-feature access goes through the owning
module's exported provider. The current health endpoint is not a complete
business-domain reference slice; establish that with the first real feature.

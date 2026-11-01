# Feature roadmap

These macro features group the agreed [product decisions](product-decisions.md).
They are planned scope, not completed work. Tickets 001-045 are in the
[build ticket index](tickets/README.md). Technical
constraints and existing capabilities are in [project scope](project-scope.md).

## Macro features

| ID  | Feature                     | Main flows                                                                                                                                             |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M01 | Accounts and authentication | Buyer/producer registration, login/logout, JWT and Redis sessions, saved payment methods                                                               |
| M02 | Producer onboarding         | Application details, Pending approval pages, approval/rejection, correction/resubmission, suspension restrictions                                      |
| M03 | Catalogue and products      | Product/profile/image/stock management, public search/filtering, producer maps, responsive pages, persistent guest cart                                |
| M04 | Checkout and orders         | Simulated card payment, atomic multi-producer checkout, per-producer fees, delivery/collection tracking, Pending-only refund requests and cancellation |
| M05 | Auctions                    | Scheduled lots, reserved stock, public live watching, eligible buyer bidding, deadline extensions, automatic payment and winner orders                 |
| M06 | Notifications and reviews   | Persistent inbox, live toasts, unread state, one producer review per completed order, reports and moderation support                                   |
| M07 | Producer dashboard          | Sales and order metrics, best sellers, per-product low-stock thresholds                                                                                |
| M08 | Laravel administration      | Approvals, suspension, product/review moderation, order/auction inspection and service health                                                          |

Macro IDs are distinct from numbered build-ticket IDs. A macro can
contain several tickets, and one complete flow can touch both Web and API.

## Suggested breakdown order

Start with M01 and UI foundation 045 before implementing feature screens.
Establish the minimum approval behavior needed by M02
before producer publishing in M03. M04 depends on accounts, products and stock.
M05 additionally needs saved payment methods and collection-order creation.
Notifications can be introduced with their first real event and expanded in M06.
M07 consumes the order/auction data already produced by those flows.

Laravel UI work can follow the core Web/API foundation, but required NestJS
administrative operations must be introduced when approval or moderation first
needs them. Do not implement a temporary React admin or bypass approvals merely
because the Laravel interface is scheduled later.

This is a suggested product dependency order, not a rigid sequence of separate
execution stages. Resolve meaningful open decisions from product-decisions.md
before marking an affected ticket ready to build.

## Agreed ticket and PR workflow

- Draft numbered Markdown tickets in the repository from agreed product flows.
  They will be versioned on GitHub; no external issue tracker is required.
- A ticket should state its macro feature, intended behavior, scope, dependencies,
  acceptance criteria and proportionate checks. Record its PR link when opened.
- `build N` is the intended instruction to pick up numbered ticket N, implement
  it, run relevant checks and open a ready-for-review PR. Merging stays with the
  user. Do not mark failed or unverified acceptance criteria complete.
- Always stack new ticket work on the tip of the latest open feature PR, even
  for unrelated work. When none is open, start from `main`. This is the user's
  explicit preference over stacking only on ticket dependencies.
- Ticket dependencies still determine readiness. The branch parent does not
  prove that a required feature exists. Merge stacks bottom-up and update the
  remaining PR bases/branches as needed, preserving other work.
- Keep the loop lean. Do not add duplicate PLAN.md/STATE.md files, mandatory
  handoff ceremonies, automatic merges or a heavyweight build pipeline.

Numbered drafts cover M01-M08 and demo setup under `docs/tickets/`, with explicit
blockers for unresolved decisions, a template and a Sol/builder
handoff in the index. The project-local `build` skill now defines ingestion,
chat planning, cheaper implementation, frontier review/corrections and stacked
ready-for-review PR publication. It is an agent workflow, not a shell command.
Existing `plan`/`grill-me` skills provide its planning and question resolution.

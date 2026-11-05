# Project scope

The PDF describes an individual seven-week local-producer marketplace project.
The user's subsequent decisions below govern this implementation. Detailed
agreed flows live in [product decisions](product-decisions.md), with the work
grouped in the [feature roadmap](feature-roadmap.md). Differences from the
assignment should be recorded in the final report. The implementation guide is
reference material; explicit user decisions take precedence over its examples.

## Agreed technology and delivery

- pnpm monorepo: React Web + NestJS API first; Laravel backoffice later.
- English UI/documentation/identifiers. TypeScript for all authored executable
  Web/API code, scripts, tests and configuration; Laravel will necessarily use PHP.
- React Compiler enabled across the frontend for its full supported benefits,
  with Rules of React and compiler diagnostics enforced. Manual memoization is
  exceptional, not the default development style.
- shadcn/ui, ReUI and Tailwind; no Bootstrap/SASS requirement in this implementation.
- Every application screen must be responsive and mobile-first, using three
  screen ranges: below 768px, 768px to below 1280px, and 1280px upward, with
  Tailwind base styles, `md:` and `xl:` variants. Navigation, forms, cart, orders
  and other layouts adapt to the available space within these ranges. Product
  grids specifically use two, three and four columns respectively.
  These are three layout ranges separated by two breakpoints; no SASS map is needed.
- Docker MongoDB and Floci for local S3 emulation, replacing the earlier
  RustFS/MinIO storage choice at the user's request.
- Redis runs locally in Docker for expiring authentication session data,
  including refresh-token sessions and revocation. JWT verification stays in the
  API; login, rotation and revocation are implemented.
- Local HTTP development. HTTPS is undecided and not part of initial setup.
- No cloud deployment or separate prototype deliverable.

## Product functionality to implement

- Visitors: catalogue search/filter by category, producer, location, season and
  production method; producer pages with map, reviews and products; registration.
- Buyers: cart, collection/delivery orders, status tracking, live notifications,
  reviews after delivery and live auction participation.
- Producers: products, prices, stock, images and public profile; order handling;
  auction creation/monitoring; sales statistics and low-stock indicators.
- Administrators (Laravel): approve/reject producers, moderate content/reviews,
  inspect users/orders/auctions and service health.
- Delivery orders: pending, confirmed, shipped, delivered. Collection orders:
  pending, confirmed, ready for collection, collected. Producers advance one
  step at a time; pending orders support the agreed refund/cancellation flow.
- Auctions: starting price, minimum increment, duration, authenticated bids,
  bid history, participant count, synchronized countdown and rejection messages.
- Server-authoritative atomic bid acceptance, persisted history and consistent
  broadcasts to auction rooms; personal rooms for order notifications.
- JWT expiration, password hashing, role/ownership checks, validated input and
  complete OpenAPI documentation.

## Delivery evidence

- Regular Git commits and README installation/run instructions.
- Document architecture, framework choices, embedding/references, concurrent bid
  handling, difficulties and AI assistance in a report (assignment limit: 20 pages).
- Demonstration video (assignment limit: 5 minutes) and individual defence
  (15 minutes). Public cloud URLs and cloud scaling/cost analysis are excluded
  from the user's current scope.

## Current foundation

Workspace tooling, the React frontend, NestJS authentication, catalogue,
checkout/orders, auctions and administrator API features are implemented. The
Laravel backoffice supports administrative sign-in, producer application
review and suspension, and product/reported-review moderation. Order, auction,
user and service-health inspection screens remain future work.
Redis infrastructure is configured and the API manages a required Redis connection
for readiness. Authentication sessions use hashed refresh credentials, atomic rotation and absolute TTLs.

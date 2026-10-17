# Project scope

The PDF describes an individual seven-week local-producer marketplace project.
The user's subsequent decisions below govern this implementation. Differences
from the assignment should be recorded in the final report.

## Agreed technology and delivery

- pnpm monorepo: React Web + NestJS API first; Laravel backoffice later.
- English UI/documentation/identifiers. TypeScript for all authored executable
  Web/API code, scripts, tests and configuration; Laravel will necessarily use PHP.
- React Compiler enabled across the frontend for its full supported benefits,
  with Rules of React and compiler diagnostics enforced. Manual memoization is
  exceptional, not the default development style.
- shadcn/ui, ReUI and Tailwind; no Bootstrap/SASS requirement in this implementation.
- Docker MongoDB and local S3-compatible storage. RustFS replaces the originally
  suggested MinIO because MinIO's community repository is no longer maintained.
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
- Order lifecycle: pending, confirmed, ready, delivered.
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

Only workspace tooling, agent guidance, a minimal frontend, API health/docs,
MongoDB connectivity and S3 initialization are implemented. Authentication,
catalogue, ordering, auctions and Laravel remain future feature work.

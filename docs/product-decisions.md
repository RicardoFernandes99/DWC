# Product decisions

Agreed on 2026-11-01. These rules describe planned behavior, not implemented
features. Read [project scope](project-scope.md) for the stack and delivery
constraints and [feature roadmap](feature-roadmap.md) for macro features.

The implementation guide is a reference. The decisions here supersede its
examples where they differ. Earlier proposals in chat that were subsequently
replaced are not requirements.

## Accounts and producer onboarding

- Users choose buyer or producer at registration. Administrator registration is
  not public.
- Roles follow the guide's separation: buyers purchase and bid; producers sell
  and create auctions. Producers cannot purchase or bid using their producer
  account. This replaces the earlier proposal to give producers buyer abilities.
- Resolve the session before checking route access. Signed-in users visiting
  another role's routes, or sign-in/registration pages, return to the homepage.
  Guests visiting protected pages sign in with a return path checked against
  their role after login. Public browsing and guest carts remain available.
- Producer navigation and product pages hide cart and purchase controls. Signing
  in as a producer preserves any existing guest cart. Suspended producers retain
  access to existing orders and refunds while selling restrictions remain intact.
- New producers await administrator approval before using selling tools. They
  can sign in and see their status, but cannot prepare product drafts, publish
  products or create auctions. Selling pages show "Pending approval" instead of
  creation forms.
- Rejected producers see the rejection reason, can correct their application
  and resubmit. They do not gain buyer capabilities while pending or rejected.
- Authentication uses password hashing, JWT signature/expiry verification and
  server-side role/ownership checks. Redis is selected for expiring session and
  revocation data. Access JWTs last 15 minutes and stay in browser memory. Refresh
  credentials use an HttpOnly cookie backed by a 7-day Redis session. Logout
  revokes the session. See [ticket 003](tickets/003-auth-sessions-api.md) for the
  proposed implementation details beyond these agreed choices.

## Public browsing, catalogue and cart

- Visitors can browse the catalogue, producer pages, auction listings and live
  auction details without signing in. Checkout and bidding require a buyer
  account; bidding additionally requires an eligible saved payment method.
- Catalogue discovery includes text search, price range, sorting and filters
  for category, producer, location, season and production method.
- Producer pages show map location, products, auctions and reviews. Delivery
  radius calculations and geographic delivery restrictions are out of scope.
- A cart can contain products from several producers. A guest cart survives
  refresh and is retained when signing in as a buyer.
- Every screen is responsive and mobile-first. The shared screen ranges and
  product-grid column counts are defined in [project scope](project-scope.md).
- Product units use discrete pack/unit identifiers so all stock quantities,
  low-stock thresholds, checkout line quantities and auction lot quantities are
  strictly non-negative integers (`step = 1`, no binary floats or fractional
  decimal quantities): `unit`, `bunch`, `box`, `jar`, `bottle`, `bag`, `kg`,
  `g_500`, `g_250`, `l`, `ml_500`.
- Catalogue and product management use fixed enum values:
  - Categories: `vegetables`, `fruits`, `dairy`, `eggs`, `meat`, `bakery`,
    `pantry`, `beverages`, `other`.
  - Production methods: `organic`, `sustainable`, `conventional`, `artisanal`,
    `biodynamic`.
  - Seasons: `spring`, `summer`, `autumn`, `winter`, `year_round`.

## Checkout, stock and payment

- One checkout creates a separate order for each producer. Each producer handles
  only their own orders and status changes.
- Checkout is all or nothing. The API rechecks current prices, stock and producer
  eligibility. Failure creates no orders and leaves no stock deductions or
  successful simulated payment behind. The buyer's cart remains available.
- Unavailable cart lines have distinct styling and explicit text such as
  "Out of stock" or "Only X available". Buyers remove them or adjust quantities
  before retrying. Suspended producers' products are also blocked at checkout,
  including products already in a cart.
- Order lines preserve the product details and price at purchase time.
- Payment uses a normal card-payment form with arbitrary card numbers accepted
  and expiry-date validation. No real charge occurs, and the UI does not display
  a "simulated payment" label or require a separate "Simulate payment" action.
- Full card numbers and CVVs are never stored or logged. Saved payment methods
  retain a generated payment-method ID, last four digits and expiry only.
- Invoice generation is intended, but its format, contents and whether it is a
  downloadable PDF remain TBD. No invoice implementation is implied by this doc.

## Collection and delivery fees

- All producers support both collection and delivery for catalogue orders.
- The buyer chooses collection or delivery once for the entire checkout. For
  delivery, the same address applies to every producer's order. For collection,
  the buyer collects separately from each producer.
- Delivery costs EUR 5 per producer's order when that order's product subtotal
  is below EUR 50. Delivery is free at EUR 50 or more per producer. Collection
  is free. There are no delivery-area restrictions in this version.
- Fees and eligibility are calculated by the API, not accepted from the client.
- A cancelled/refunded order refunds its products and its delivery fee. Other
  orders from the checkout are unaffected.
- These rules replace the earlier EUR 100 checkout-wide threshold and the
  proposal that delivery fees would be non-refundable.

## Order tracking and refunds

- Delivery: Pending -> Confirmed -> Shipped -> Delivered.
- Collection: Pending -> Confirmed -> Ready for collection -> Collected.
- Producers update every step, including the final handover. Normal fulfilment
  advances one step at a time, with no skipping or backward transitions.
- Only Pending orders support buyer refund requests or producer cancellation.
- A buyer requests a refund rather than cancelling immediately. The order stays
  Pending, and confirmation is blocked while that request is open.
- The producer accepts or declines the request. Acceptance cancels the order,
  records the simulated refund and restores stock. Declining requires a reason
  and allows the order to proceed.
- A producer can directly "Cancel and refund" a Pending order, with the same
  refund and stock restoration effects.
- Delivered and Collected orders are eligible for reviews. Auction orders enter
  directly at Confirmed and therefore do not use the Pending-only refund flow.

## Auctions

- An approved, unsuspended producer creates an auction for a fixed quantity of
  an existing product. Creation reserves that quantity from catalogue stock so
  it cannot also be sold through normal checkout.
- Buyers bid for the whole lot; the winning amount is the price of that lot.
- Producers may edit or cancel only before the scheduled start. Cancellation
  releases the reserved quantity. Active auction terms are locked apart from
  the automatic deadline extension described below.
- The first bid may equal the starting price. Subsequent bids must be at least
  the current highest bid plus the minimum increment.
- Buyers need a saved, unexpired payment method before bidding. Expired methods
  block new bids. The winner is automatically charged through the simulated flow.
- An accepted bid with less than 10 seconds remaining resets the deadline to
  10 seconds after acceptance. The countdown then continues. This can repeat;
  rejected bids do not extend time, and bids at or after expiry are rejected.
- The API atomically accepts bids and updates any deadline extension, persists
  bid history consistently and broadcasts the accepted state. The browser
  countdown reflects the server deadline and does not determine bid validity.
- Public auction details include live bids, bid history, participant count,
  synchronized countdown and clear rejection feedback for bidders.
- Use Socket.io through NestJS gateways for live auction updates and notification
  delivery. Gateways call domain services, authorize actions and room access,
  and broadcast only accepted, persisted changes. Reconnecting clients fetch
  current server state; public watching does not grant bidding permissions.
- Auction viewer counts count connected sockets currently watching an auction.
  They are labelled “viewers”; multiple tabs for one account count separately,
  and guests are included.
- At closure, a winner receives a Confirmed collection order for the lot and
  the simulated payment is recorded automatically. No second checkout is needed.
- An auction without accepted bids releases its reserved quantity back to stock.
- Closing/settlement must not create duplicate orders or payments when retried.

### Auction settlement policy (ticket 028)

- Accepting a bid snapshots the saved method's last four digits and expiry.
  The simulated winner payment succeeds automatically at auction close even if
  that card has since expired or been removed. The buyer receives a warning to
  add a new card for future purchases and bids; the warning never blocks the
  paid Confirmed collection order. No random declines or real gateway behavior
  are simulated. Technical/database failures roll back and leave settlement
  retryable with a logged failure.
- A legacy accepted bid with no snapshot may settle from the still-existing
  payment method owned by that bidder. If it is missing, settlement remains due
  and fails with a logged retryable error; card data is never invented and the
  accepted winner is never silently discarded.

## Notifications and reviews

- Notifications persist in an in-app inbox with unread indicators and also
  appear as live toasts. Offline users can read missed notifications later.
- Events include order changes, refund decisions, producer approval/rejection
  decisions and auction results.
- A buyer can leave one producer review per Delivered or Collected order,
  including auction orders: a 1-5 star rating and optional comment.
- Reviews can be reported, and administrators can hide them. Reviews are about
  the producer rather than separate ratings for every purchased product.
- Review API rules: only the order's buyer reviews, once per Delivered or
  Collected order (auction included; enforced by a unique order index, duplicate
  or concurrent retries get 409 `review_exists`; non-completed orders get 409
  `order_not_reviewable`; foreign or missing orders get 404). Comments are
  trimmed plain text up to 1000 characters; blank becomes none. Public lists
  show only visible reviews, newest first, with the reviewer's first name only
  and a visible-only average (one decimal) and count. Producers cannot review.
- Reporting: buyers and producers may report a visible review with a required
  category (spam, offensive, off_topic, false_information, other) and optional
  note up to 500 characters. One report per user and review; retries return
  success and keep the first report. Reporting your own review is refused (403
  `own_review`); hidden or missing reviews are 404. Reporter identity and notes
  are never public, and report counts never hide a review automatically.

## Producer dashboard

- Show sales totals, order counts, best-selling products and low-stock warnings.
- Each product has a configurable low-stock threshold.
- Sales include auction sales and exclude cancelled/refunded orders. Because a
  refund always cancels a whole Pending order, every non-cancelled order counts
  as a sale from when it was placed (Pending through Delivered/Collected; auction
  orders from settlement). Completed fulfilment is not required.
- Revenue is product revenue: the sum of the original order line amounts.
  Delivery fees are reported separately and never mixed into product revenue.
- Reporting periods are rolling presets measured back from the server's current
  time: last 7, 30 or 90 days, or all time (default 30 days). Orders are dated by
  their creation time, so no calendar time zone is involved.
- Best sellers are the top 5 products by product revenue in the period, ties
  broken by order count and then product ID. Units sold are shown per product in
  that product's own unit and are never summed across products.
- Low-stock warnings list the producer's non-archived products whose current
  available catalogue stock is at or below their threshold. Stock reserved for
  auctions is already removed from available stock and does not count.

## Laravel administration and suspension

- Laravel is the planned additional backoffice, not a React administration app.
  NestJS remains authoritative for business rules and permissions.
- Admin tools include producer approval/rejection, user suspension, hiding
  products/reviews, read-only order/auction inspection and service health.
- Suspended producers see: "Your account is suspended until the issue is
  resolved. You cannot create new auctions or register new products."
- A suspended producer cannot register products, create auctions or receive new
  catalogue sales. Their normal-sale products are hidden from public listings
  and blocked at checkout by checking current producer status in the API.
- Products remain stored. Lifting suspension restores normal visibility only
  for products that are otherwise published and not separately moderated.
- Existing orders can still be fulfilled, and active auctions finish normally.
  Scheduled auctions cannot start while the producer is suspended.
- If a scheduled auction cannot start because its producer is suspended, it is
  cancelled at that missed start and its reserved stock is released exactly once;
  it is never shifted or shortened. The server recovers scheduled auctions after
  downtime using their original start and end times. If the producer is still
  approved and no suspension decision occurred after the start, an overdue
  auction becomes active with those original times (it may already be time-ended
  for bids and ready for settlement). If suspension is still in force, or the
  producer was reinstated after the missed start, the auction is cancelled and
  its lot is released. Active auctions finish normally while the producer is
  suspended. Auction settlement and no-bid stock handling follow the policy
  above.
- Producer status decisions must update `producerDecisionAt`; the scheduler uses
  it to detect reinstatement after a missed auction start. Profile edits do not
  count as status decisions.
- Suspension API: `POST /api/admin/producers/:id/suspend` (`{ revision, reason }`) and
  `POST /api/admin/producers/:id/reinstate` (`{ revision }`), admin only. Only an
  approved producer can be suspended; reinstatement only from suspended and always
  returns to approved. Other statuses or stale revisions answer 409.
- The suspension reason (required, 1-500 chars) is visible to the producer through
  `suspensionReason` on their application status and the admin item, and is non-null
  only while suspended. Suspending and reinstating each create one inbox
  notification for the producer.

## Open decisions

Resolve these with the affected tickets, without blocking unrelated work:

- Invoice format, required information and PDF download.
- Account recovery scope. Session implementation details are drafted in ticket 003.
- Buyer suspension behavior, including effects on existing bids/orders.

# 005: Save buyer payment-method metadata

- Macro: M01
- Status: In progress
- Depends on: 003
- PR: Not opened
- Branch / parent: codex/age-005-payment-methods-api / main
- Blockers: None beyond dependencies; auction settlement remains a later decision

## Outcome

Buyers can add and list a saved payment method for later checkout and bidding.
This stores display metadata and an application-generated ID, not usable card data.

## Read first

- [Payment decisions](../product-decisions.md#checkout-stock-and-payment) and
  [auction eligibility](../product-decisions.md#auctions).
- [Authentication contract](003-auth-sessions-api.md), API guidance and `api-feature`.
- User/session modules from 001/003 and existing global validation/OpenAPI setup.

## Scope and contract

- Add a user-owned payment-method schema with generated ID, owner, last four
  digits, expiry month/year and timestamps. Owner is always authenticated identity.
  Index the actual owner/list query. Return explicit public DTOs.
- `POST /api/payment-methods`: `{ last4, expiryMonth, expiryYear }`, 201 with
  `{ id, last4, expiryMonth, expiryYear, expired }`. The browser reduces the
  arbitrary card number to last4; the API never receives full card numbers/CVV.
  This is application metadata, not payment-provider tokenization or a real charge.
- Accept any four digits for `last4`, with no Luhn, issuer, bank or payment-gateway
  check. Validate integer month 1-12 and bounded four-digit year. A card expires
  after its stated month, using server UTC; a past month is rejected with 400.
- `GET /api/payment-methods`: 200 with the current buyer's method DTO array,
  newest first. Existing expired methods stay visible with `expired: true`.
- Only buyers may create/list these methods: 401 without a session, 403 for
  producer/admin roles. Reject caller-supplied owner, ID and unknown fields.
- No default-card selection, editing/removal endpoint, charges, refunds or auction
  linkage here. Those need their actual consumers. A future winning bid must not
  become unpayable because a later method-removal feature ignores active bids.
- Provide a small domain lookup for later buyer-owned/unexpired eligibility,
  without creating fake bidding endpoints. API validation remains authoritative
  even though these records deliberately represent simulated payment methods.

## Acceptance criteria

- [x] A buyer adds a method and sees masked metadata in their own list.
- [x] Other accounts cannot read another buyer's methods or assign their owner.
- [x] Arbitrary last4 digits pass; malformed/expired dates and extra card fields fail.
- [x] The current expiry month is valid; the previous month is expired, including
      the December/January boundary. Existing expiry is recalculated from server time.
- [x] Responses and stored documents contain no full card numbers or CVVs.
- [x] Producer/admin access is refused and routes/errors are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Add/list a dummy method, try an expired date and confirm another account cannot access it. Inspect that only last4/expiry metadata was stored.

## Delivery notes

Implemented on `codex/age-005-payment-methods-api`, parent `main` at
`649e1fa19eaadf3e2c07da9894b19cdd0fe05a6a`. PR publication follows orchestrator review.

- API typecheck/build, root lint, scoped Prettier, contract generation/check, Web
  typecheck and Web build passed with Node 24.22.1 and pnpm 11.25.0.
- Real HTTP against local MongoDB/Redis: unauthenticated create returned 401;
  buyer create/list returned 201/200; another buyer saw an empty list; producer
  and test-owned administrator-role accounts received 403. Malformed last4,
  prior-month expiry, caller-supplied owner on create and ownerId query returned 400. Arbitrary `0000` last4 and the current UTC expiry month were accepted.
- Persistence inspection found only `_id`, ownerId, last4, expiry month/year,
  timestamps and Mongoose version in the method document. The response contained
  only id, last4, expiry month/year and expired. A previously valid method remained
  listed as expired after its stored expiry was moved into a past UTC month.
- With a fixed clock at 2027-01-01 UTC, the actual `findOwnedUnexpired` service
  returned null for December 2026, a method for January 2027, and null for a
  foreign owner or malformed ID. This verifies the December/January cutoff.
- All temporary HTTP accounts, payment-method documents and lookup records were
  removed. No project `.env` values were changed; the API used temporary
  process-only settings for manual requests.
- Token/credit usage is unavailable in this client. No payment provider, charges,
  auction integration or UI is included.

- Builder: gpt-6-luna, medium effort. One correction round aligned the list
  index with its stable sort and rejected unknown list query fields. No model
  adaptation. Input, cached input, output/reasoning usage and total cost unavailable.
- Frontier verdict: APPROVED against parent 649e1fa19eaadf3e2c07da9894b19cdd0fe05a6a.
  All ticket acceptance checks passed on the implementation committed with these notes.

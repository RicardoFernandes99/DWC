# 005: Save buyer payment-method metadata

- Macro: M01
- Status: Draft
- Depends on: 003
- PR: Not opened
- Branch / parent: Not assigned
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

- [ ] A buyer adds a method and sees masked metadata in their own list.
- [ ] Other accounts cannot read another buyer's methods or assign their owner.
- [ ] Arbitrary last4 digits pass; malformed/expired dates and extra card fields fail.
- [ ] The current expiry month is valid; the previous month is expired, including
      the December/January boundary. Existing expiry is recalculated from server time.
- [ ] Responses and stored documents contain no full card numbers or CVVs.
- [ ] Producer/admin access is refused and routes/errors are documented in OpenAPI.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Add/list a dummy method, try an expired date and confirm another account cannot access it. Inspect that only last4/expiry metadata was stored.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

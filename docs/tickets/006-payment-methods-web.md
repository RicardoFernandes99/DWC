# 006: Manage saved payment methods from the buyer account

- Macro: M01
- Status: Draft
- Depends on: 004, 005
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

A buyer can enter an arbitrary card number and expiry, save its metadata and
see their masked saved methods. This prepares the account for later bidding.

## Read first

- [Payment decisions](../product-decisions.md#checkout-stock-and-payment).
- [Web session contract](004-auth-web.md), [method API](005-payment-methods-api.md).
- Web guidance and `web-feature`/`design-engineering`.
- Account route, shared HTTP/session client and form/query conventions from 004.

## Scope and contract

- Add a payment-method section to `/account`, visible to buyers only. Use the
  existing authenticated HTTP client and Query ownership/caching conventions.
- Normal UI copy such as "Payment methods", "Add card" and "Save card"; do not
  label it simulated or request an actual payment. There is no real charge.
- Collect card number, expiry month/year. Accept arbitrary digit sequences with
  at least four digits; allow spaces for entry and cap length reasonably.
  Do not implement Luhn, issuer validation or collect CVV. Validate expiry with
  the same month-end semantics as 005, while respecting API rejection.
- Convert to last4 in memory and send only `{ last4, expiryMonth, expiryYear }`.
  Never persist card input in storage, URLs, query caches or logs. Clear the full
  number on successful save or when leaving the form.
- List masked last4/expiry from the API; label expired methods explicitly. Include
  loading, empty, pending, API validation and network failure states. Do not
  invent a card brand from arbitrary numbers.
- No removal/default-card feature, checkout, bidding controls, invoices or producer
  access. Do not show success before the save request succeeds.

## Acceptance criteria

- [ ] A signed-in buyer adds a method and sees the API-returned masked record.
- [ ] Only last4 and expiry appear in the outgoing request; arbitrary card digits
      work without payment-provider checks or a simulation label.
- [ ] Expired/invalid dates fail clearly; a failed request preserves safe retry UX
      and restores controls without exposing the number elsewhere.
- [ ] Empty, expired and loading states are distinct; logout/account switching
      clears user-scoped payment data through the session flow.
- [ ] Producers cannot access buyer payment UI, and API refusals remain handled.
- [ ] Labels, keyboard navigation and feedback work at all three screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Save and reload a dummy method, inspect the outgoing payload, and try a rejected expiry date. Check responsive form and keyboard behavior.

## Delivery notes

Not implemented. Sol records actual evidence and PR/stack metadata here.

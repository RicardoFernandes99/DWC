# 018: Complete checkout with one fulfilment choice and card payment

- Macro: M04
- Status: Draft
- Depends on: 006, 015, 016, 017
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Buyers review grouped totals, choose delivery/collection once, pay through a normal
card UI and receive confirmation of each producer order.

## Read first

[Checkout and fees](../product-decisions.md#checkout-stock-and-payment),
[web guidance](../../apps/web/AGENTS.md), cart/payment UI and 016/017 contracts.

## Scope and contract

- Add `/checkout` with buyer-login return flow, one method/address selection and
  per-producer subtotal/delivery/total plus combined amount from the quote API.
- Use a saved eligible method or reuse the arbitrary-card entry from 006. Send
  last4/expiry to 005, then its ID to checkout; no full card number/CVV reaches
  API, storage, caches or logs. Use normal payment copy, no simulation label.
- Keep one idempotency key for retries of the same submitted attempt. Prevent
  double submits and preserve recovery after an uncertain network response.
- On stock/status failure retain the cart and mark affected lines with distinct
  styling and text. On changed prices request a new review/confirmation.
- Clear purchased cart lines only after confirmed success; show separate order
  references and links. Do not fabricate invoices or downloads while 037 is blocked.
- Producer accounts cannot checkout; guest cart survives sign-in as agreed.

## Acceptance criteria

- [ ] Both fulfilment modes, grouped fees and saved/new method flows work.
- [ ] Failed checkout creates no success screen or lost cart; line errors are actionable.
- [ ] Network retry/double click cannot create duplicate orders or payment records.
- [ ] Address validation, expired methods and session expiry are handled clearly.
- [ ] Keyboard, accessible payment feedback and all responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Complete a multi-producer checkout with dummy payment metadata, then try a stock conflict/retry. Confirm the failed attempt preserves the cart and check responsive/keyboard use.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

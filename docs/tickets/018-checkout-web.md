# 018: Complete checkout with one fulfilment choice and card payment

- Macro: M04
- Status: In review
- Depends on: 006, 015, 016, 017
- PR: https://github.com/RicardoFernandes99/DWC/pull/29
- Branch / parent: codex/age-018-checkout-web / codex/age-017-atomic-checkout-api
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

- [x] Both fulfilment modes, grouped fees and saved/new method flows work.
- [x] Failed checkout creates no success screen or lost cart; line errors are actionable.
- [x] Network retry/double click cannot create duplicate orders or payment records.
- [x] Address validation, expired methods and session expiry are handled clearly.
- [x] Keyboard, accessible payment feedback and all responsive ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Complete a multi-producer checkout with dummy payment metadata, then try a stock conflict/retry. Confirm the failed attempt preserves the cart and check responsive/keyboard use.

## Delivery notes

Implemented `/checkout` page with:

- One-page review grouped by producer.
- Delivery vs Farm Collection toggle with automatic fee computation (€5.00/producer or free for orders over €50.00 / collection).
- Single delivery address form with validation, country defaults to Portugal, optional notes, and client storage persistence for returning buyers.
- Saved payment method selector with active/unexpired filtering and seamless new card entry saving directly via 005 API without exposing full card details or CVV.
- Single-attempt client idempotency key with in-flight disable state preventing double submission.
- Inline actionable line issue alerts for stock shortage / unavailable produce without discarding cart contents.
- Handling for 409 `price_changed` conflict requiring explicit buyer acknowledgement of updated totals.
- Confirmation screen presenting separate per-producer order references, item counts, statuses, and payment summary with link back to catalogue and account.
- Cart clearing of purchased items upon confirmed checkout success.

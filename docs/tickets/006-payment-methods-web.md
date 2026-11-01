# 006: Manage saved payment methods from the buyer account

- Macro: M01
- Status: In progress
- Depends on: 004, 005
- PR: Not opened (orchestrator owns publication)
- Branch / parent: `codex/age-006-payment-methods-web` / `codex/age-005-payment-methods-api` at `758ee7a736b4d9b5dd35797ba91c524d26857211`
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

- [x] A signed-in buyer adds a method and sees the API-returned masked record.
- [x] Only last4 and expiry appear in the outgoing request; arbitrary card digits
      work without payment-provider checks or a simulation label.
- [x] Expired/invalid dates fail clearly; a failed request preserves safe retry UX
      and restores controls without exposing the number elsewhere.
- [x] Empty, expired and loading states are distinct; logout/account switching
      clears user-scoped payment data through the session flow.
- [x] Producers cannot access buyer payment UI, and API refusals remain handled.
- [x] Labels, keyboard navigation and feedback work at all three screen ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Save and reload a dummy method, inspect the outgoing payload, and try a rejected expiry date. Check responsive form and keyboard behavior.

## Delivery notes

Implemented on `codex/age-006-payment-methods-web`, based on
PR #13's API contract. UTC month/year validation follows the API's calendar-month
cutoff and accepted year range from 1000 to 9999. The buyer-only account section lists
and saves API-owned masked records; raw card input stays in the mounted form and
is reduced to last four digits before the request. Session-aware API requests
share the existing refresh/retry behavior and reject results from an older session.

Implementation checks passed with Node 24.22.1 and pnpm 11.25.0: Web typecheck,
Web production build with React Compiler output verification, Web tests (10/10),
root lint, scoped Prettier check and `pnpm contract:check`. Browser review and the
frontier verdict are pending. Sol owns the final verdict and PR/stack metadata.

- Frontier verdict: APPROVED against parent PR #13 at
  `758ee7a736b4d9b5dd35797ba91c524d26857211`.
- Real Chrome/API check saved arbitrary `1234 0000`, observed only last4 `0000`
  and expiry in the POST payload, reloaded the masked record, and confirmed the
  number cleared after success. Prior-month/year input failed locally.
- Forced HTTP 400 and network failures preserved input and restored Save controls.
  Delayed/controlled list responses verified loading and expired feedback.
- Logout and a second buyer login showed an empty list and cleared form. Producer
  UI omitted payment methods and its real API request returned 403.
- Keyboard tab order and no horizontal overflow passed at widths 375, 767, 768,
  900, 1279, 1280 and 1440. Desktop and mobile screenshots were visually reviewed.
- Browser checks used an isolated Vite server on 5174 with matching temporary API
  origin settings. Existing Web server and project .env were preserved.
- Builder: gpt-6-luna, medium effort. No model changes or formal correction rounds;
  review feedback during implementation addressed stale-session responses and
  mutation feedback. Token, cached-input, output/reasoning usage and cost unavailable.
- No removal, default-card selection, charges, checkout or bidding controls added.

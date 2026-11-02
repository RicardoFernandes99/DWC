# 016: Quote a multi-producer checkout with delivery fees

- Macro: M04
- Status: In review
- Depends on: 010, 013, 003
- PR: https://github.com/RicardoFernandes99/DWC/pull/27
- Branch / parent: codex/age-016-checkout-quote-api / codex/age-015-guest-cart-web (#25)
- Blockers: None beyond dependencies

## Outcome

A buyer sees current per-producer totals, availability issues and the correct
delivery charge before submitting payment.

## Read first

[Checkout](../product-decisions.md#checkout-stock-and-payment),
[fees](../product-decisions.md#collection-and-delivery-fees),
[API guidance](../../apps/api/AGENTS.md), product/session contracts.

## Scope and contract

- `POST /api/checkout/quote` accepts product IDs/quantities and one fulfilment
  choice, plus one delivery address when needed. Require buyer role.
- Return canonical line details and per-producer groups, item subtotal, delivery
  fee, group total and combined total, all monetary values in integer EUR cents.
- Delivery is 500 cents per producer when that group's product subtotal is below
  5000 cents; free from 5000. Collection is free. Same delivery address applies to
  all groups; no geographic exclusions or per-producer method choice.
- Bound line counts/quantities, normalize duplicate product IDs before stock
  checking, validate IDs/address and report structured line issues for insufficient
  stock, unavailable products or suspended producers.
- Quote neither reserves stock nor charges payment/creates orders. It is advisory;
  017 revalidates at commit. Provide a canonical price/version fingerprint so stale
  price/fee changes can require buyer reconfirmation rather than silent charging.

## Acceptance criteria

- [x] EUR 49.99 incurs EUR 5; EUR 50.00 is free independently per producer.
- [x] Mixed-producer totals and free collection are correct and client totals ignored.
- [x] Insufficient stock/suspended products map to stable line-level issue codes.
- [x] Duplicate lines cannot evade quantity checks; quote makes no persistent writes.
- [x] Producer/guest requests, bad quantities and incomplete delivery addresses fail.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Quote two producers, verify EUR 49.99 versus EUR 50 delivery boundaries and free collection, then try an unavailable line. Confirm quoting changes no stock.

## Delivery notes

- Implementation: `POST /api/checkout/quote` implemented in `apps/api/src/checkout/` with `RoleGuard` (`@Roles(UserRole.Buyer)`), canonical line details grouped by producer, item subtotals, per-producer EUR 5 vs free (>= 5000 cents) delivery fees, free collection, duplicate line normalization, structured issues (`insufficient_stock`, `unavailable_product`, `producer_suspended`), and deterministic SHA-256 pricing/version fingerprint.
- PR: https://github.com/RicardoFernandes99/DWC/pull/27 stacked on PR #25 (`codex/age-015-guest-cart-web`).
- Evidence:
  - `apps/api/test/checkout-quote.test.ts` (15/15 tests passing): verified EUR 49.99 incurs 500 cents delivery fee, EUR 50.00 is free independently per producer, free collection, duplicate line evasion protection, structured issue codes, delivery address requirement, advisory read-only nature (no DB writes), fingerprint determinism, and buyer RoleGuard enforcement.
  - `pnpm contract:check`: verified OpenAPI schema export and `@dwc/web` types synchronization.
  - `pnpm --filter @dwc/api typecheck` & `pnpm --filter @dwc/web typecheck`: 0 errors.
  - `pnpm --filter @dwc/web build`: clean build, React compiler output verified.
  - `pnpm lint`: 0 warnings, 0 errors.

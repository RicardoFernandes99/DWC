# 043: Generate agreed invoice output from purchase snapshots

- Macro: M04
- Status: Blocked
- Depends on: 017, 020, 028
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: Decide document format, contents, per-order/checkout grouping, refund representation and whether PDF download is required

## Outcome

The buyer can access the agreed invoice-like purchase document with correct
historical amounts. Output format remains a user decision.

## Read first

[Payment/invoice decision](../product-decisions.md#checkout-stock-and-payment),
[fees](../product-decisions.md#collection-and-delivery-fees), order/payment snapshots.

## Scope and contract

- Settle the named choices before implementing. Do not assume a PDF, a legal tax
  invoice, a simulation watermark, VAT calculation or mandatory tax identifiers.
- Use immutable purchase snapshots and server-calculated item/fee/payment amounts;
  later product/profile changes must not alter historical document values.
- Define stable document identity/linkage and who may access it. Buyer can access
  only their own records; producer/admin access must be explicitly scoped.
- Cover normal multi-producer checkout and automatic auction collection orders,
  plus the agreed cancellation/refund representation. No external billing service.
- If PDF is chosen, implement bounded download, correct headers and render/inspect
  representative pages. If HTML/another form is chosen, verify its actual output.
- Split into generation/API and UI/download tickets if the chosen format warrants
  it; this draft reserves the known outcome without guessing its implementation.

## Acceptance criteria

- [ ] Format/content/grouping/refund decisions are recorded before implementation.
- [ ] Historical lines, totals and per-producer delivery fee/refund amounts are correct.
- [ ] Store/auction outputs reference the correct buyer, producer and order(s).
- [ ] Cross-account access is refused and no payment/auth secrets are included.
- [ ] Output is legible and downloadable only if that was the selected format.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Once document choices are agreed, inspect representative historical totals and one foreign-account refusal. If PDF is chosen, render a sample; no export test suite is required.

## Delivery notes

Not implemented. Resolve the named document choices; do not generate speculative PDFs.

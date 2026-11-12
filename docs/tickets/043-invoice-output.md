# 043: Generate agreed invoice output from purchase snapshots

- Macro: M04
- Status: In review
- Depends on: 017, 020, 028
- PR: https://github.com/RicardoFernandes99/DWC/pull/57
- Branch / parent: `codex/age-043-purchase-receipts` / `codex/age-042-buyer-suspension` (PR 56)
- Blockers: None. The user confirmed the receipt policy.

## Outcome

Buyers and authorized producers/admins can download a PDF purchase receipt per
producer order. It is not a tax invoice.

## Scope and contract

- Follow the confirmed [purchase receipt policy](../product-decisions.md#purchase-receipt-policy-ticket-043): one PDF per producer order, including auction wins; no tax fields or watermarks.
- Use immutable order values. New checkout and auction orders snapshot the buyer
  name and producer farm name. Legacy orders show account references and say
  historical names were not recorded. Never use current profiles for legacy names.
- Buyers can access their own order, producers only their order, and admins use a
  separate authenticated API route. No public links.
- Preserve original purchase totals and show an order-specific refund, cancellation
  date and remaining paid amount. Auction whole-lot price appears once.
- Bound output size and pagination, set attachment/no-store headers, and keep
  payment details and delivery addresses out of the PDF.

## Acceptance criteria

- [x] Format, content, grouping, refund and access policy are recorded.
- [x] Historical lines, totals and per-order delivery fee/refund amounts are correct.
- [x] Checkout and auction orders snapshot buyer and producer names.
- [x] Cross-account access is refused and payment/auth secrets are excluded.
- [x] PDF output is legible and downloadable through buyer, producer and admin UI.

## Checks

Run focused API/web typecheck, lint, build and contract checks. Inspect rendered
PDFs for normal checkout, multi-producer checkout, refund, auction, legacy and
long Unicode labels. Exercise authenticated buyer/producer/admin access and a
foreign-account refusal. No export test suite is required.

## Delivery notes

Confirmed policy is recorded in [product decisions](../product-decisions.md).
Parent SHA: `31bdd514990d80317b03c6b55070e66299190631`.
Frontier verdict: APPROVED after two correction rounds. Builder: gpt-6-luna High,
unchanged throughout. Usage/cost measurements were not exposed. The orchestrator
also removed one redundant PHP null coalescing expression identified by Larastan.

Passed checks: API/web strict typecheck; Nest build; Vite production build and
React Compiler verification under Node 24; OpenAPI export and generated-type
drift checks; tools typecheck; scoped Prettier; root ESLint excluding only the
pre-existing untracked `demos/ticket-040-review/review.ts` prefer-const failure;
Composer platform requirements, Pint, Larastan and Blade compilation. The local
pnpm web wrapper inherited Node 22 for its final TypeScript script; that same
script passed when run directly with the required Node 24. Existing Vite bundle
size warning remains. No new automated test suite was added.

Real manual evidence is under `demos/ticket-043-review/`: two-producer checkout,
paid/fee-free orders, owning buyer/producer/admin PDF access, foreign-account
refusals, one-order cancellation/refund, unchanged sibling receipt, historical
names/prices after profile/product edits, legacy references, real accepted
Socket.IO bid and automatic whole-lot settlement. PDFs were rendered and their
text extracted, including a four-page 50-line maximum-price accented-label case.
Buyer and admin browser downloads, keyboard activation, pending/error/retry,
an injected first-401 refresh/retry and 390/900/1440 layouts passed. The 401 and
network failures were browser fault injection, not a real backend outage.
Owned fixture records, known Redis sessions and Laravel sessions were removed.

App-screen inspector: no FAIL findings across buyer/producer/admin and download
states. Kept the approved Orchard cream, existing phone headings, admin context
label and independent status/payment column heights. The new error contrast was
corrected and rechecked on the saved real-page export after the runtime stopped
between chat turns. Before screenshots reuse ticket 041 views with their
provenance recorded; fixture content differs from the new after screenshots.

Published through native `gh stack` on stack 34, targeting PR 56. Reviewed
implementation revision: `d032fa24054949ebbbf3410663b6a169b5470b2a`.
Both CI verify jobs passed on that revision: push 1m41s and pull request 1m44s.
The following metadata-only update does not change the reviewed implementation.
Merging remains the user's decision.

# 036: Hide products and reported reviews through admin APIs

- Macro: M08
- Status: In review
- Depends on: 009, 013, 031
- PR: [#50](https://github.com/RicardoFernandes99/DWC/pull/50) (ready for review, native stack #34)
- Branch / parent: `codex/age-036-content-moderation-api` on PR #49 `codex/age-035-producer-suspension-api` (`fb352f6`)
- Blockers: None beyond dependencies

## Outcome

Admins inspect products/review reports and hide content without deleting historical
orders, reviews or product references.

## Read first

[Admin/review decisions](../product-decisions.md#laravel-administration-and-suspension),
[API guidance](../../apps/api/AGENTS.md), product/review public projections.

## Scope and contract

- Add bounded admin product/review-report lists and details. Include report reasons
  only in authorized admin responses; avoid leaking reporter identity publicly.
- Owner-independent admin hide actions record reason, actor/time and revision.
  Preserve the record, producer publication choice and historical snapshots.
- Hidden products disappear from public list/detail/quote/checkout and cannot mint
  fresh public image access. Existing orders remain intact.
- Hidden reviews disappear from public lists and rating aggregates consistently.
  Admin reads still show moderation state and reports.
- Do not silently hide active auctions or rewrite an auction's reserved lot when
  its source product is moderated; current auction commitments follow auction rules.
- No automatic takedown threshold, review response feature or public moderation page.

## Acceptance criteria

- [x] Admin can inspect/report context and hide the intended resource.
- [x] Other roles cannot use admin routes; private report data stays private.
- [x] Hidden product direct access/checkout and hidden review aggregates are excluded.
- [x] Repeated/stale moderation actions are handled without duplicate outcomes.
- [x] Existing order/auction snapshots and producer-owned records remain stored.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Hide one product and one review, then inspect public views/totals and preserved order history. Try the same action as a non-admin.

## Delivery notes

- Decisions (user, 2026-11-04): hiding is reversible (admin restore endpoints for
  products and reviews); hiding or restoring a product sends one inbox notification
  to its producer with the reason; review moderation notifies nobody. Recorded in
  [product decisions](../product-decisions.md#laravel-administration-and-suspension).
- New `moderation/` module, admin only (`AdminGuard`, `Cache-Control: no-store`):
  `GET /api/admin/products` (page, limit up to 50, state, producerId, q) and
  `GET /api/admin/products/:id` (admin-only signed image URL);
  `POST /api/admin/products/:id/hide` `{ revision, reason }` and `/restore`
  `{ revision }`; `GET /api/admin/review-reports` (reported reviews, latest report
  first, counts per category); `GET /api/admin/reviews/:id` (reports with category,
  note and reporter); `POST /api/admin/reviews/:id/hide` and `/restore`. Missing
  resources answer 404; refusals answer 409 `already_hidden`, `not_hidden` or
  `stale_revision`.
- Product hide is one conditional update (revision + current state) in a
  transaction with the notification (`product:<id>:moderation:<rev>`), published
  after commit. It records `moderatedAt`, `moderationReason` and `moderatedBy` and
  leaves `published`, stock, orders and auctions unchanged. Reviews gained
  `revision` and moderation fields; legacy reviews without `revision` count as 1.
- Public exclusion: catalogue list/detail and producer image URLs already ignored
  moderated products. The checkout quote now also flags archived or moderated
  products as unavailable, and the in-transaction stock decrement requires
  `archivedAt: null, moderatedAt: null`. Before this, a moderated or archived but
  still published product could be bought. Public review list/aggregate already
  filter `visibility: visible`; reporting a hidden review answers 404.
- Builder: Claude Sonnet (Agent tool), frontier review by Claude Opus 5.5.
  Verdict APPROVED after 0 correction rounds. Two frontier fixes: the quote check
  uses `Boolean(...)` so lean legacy products lacking the fields are not blocked,
  and review moderation sets `revision + 1` instead of `$inc` (which produced 1 on
  legacy reviews; found by the real-stack run).
- Checks on the reviewed revision: `pnpm --filter @dwc/api typecheck` and `build`,
  root `pnpm lint`, `pnpm contract:generate` (builder) and `pnpm contract:check`,
  `pnpm --filter @dwc/web typecheck`, scoped Prettier and `git diff --check` pass.
- Real stack: API built from this branch on port 3131. The fixture
  `demos/ticket-036-review/moderation-api.ts` (kept local) passed 10/10 groups:
  401/403 for anonymous, producer and buyer on all admin routes; bounded lists and
  private report detail; 400/404/409 refusals; concurrent duplicate hide (one 200,
  one 409, one notification, 500-char-capped message); hidden product excluded from
  catalogue list/detail, quote, checkout and image URL; order and auction snapshot
  unchanged; hidden review excluded from the public list and rating aggregate while
  admin still sees it; restore of both; restore never republishes an unpublished
  product.
- Limitations: no web or Laravel UI (040 consumes this API). The report list
  aggregates over all reports (fine at project scale). Auction code is unchanged;
  its behaviour with a hidden product was checked only through the stored snapshot.
  No automated tests added; usage figures are unavailable.
- PR #50 is ready for review in native stack #34. The reviewed implementation commit is `3d94279`.

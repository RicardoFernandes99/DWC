# 030: Watch and bid in public live auction rooms

- Macro: M05
- Status: In review
- Depends on: 006, 014, 025, 027, 028, 029
- PR: https://github.com/RicardoFernandes99/DWC/pull/44
- Branch / parent: `codex/age-030-live-auction-web` on `codex/age-029-producer-auctions` (PR #43)
- Blockers: None beyond dependencies

## Outcome

Visitors watch live auctions; eligible buyers bid and see synchronized extensions,
history, viewer count and settled results without refreshing.

## Read first

[Auction decisions](../product-decisions.md#auctions),
[web real-time rules](../../apps/web/AGENTS.md), APIs/events from 026-028 and 025.

## Scope and contract

- Add public auction listing/detail routes and producer-page auction section.
  Show real scheduled/active/finished state, lot, deadline, history and viewers.
- Derive countdown from server time/deadline, refresh on accepted state revisions
  and resynchronize after reconnect. Never accept bids locally or freeze auction time.
- Buyer bid form uses first-price/increment minimum, eligible saved-method selection,
  request IDs and success/refusal acknowledgement. Guests get login navigation;
  producers can watch but never bid. Missing/expired methods link to account setup.
- One shared session-aware socket setup can manage public membership and private
  notifications. Clean room listeners/membership on navigation; avoid duplicate bids.
- Reordered/missed events cannot move displayed state backwards. Reconnect fetches
  current auction/history/result; completion UI comes from persisted server settlement.
- Winner sees automatic payment/order result and collection order link. Present
  no-bid closure honestly; do not invent a second checkout or allow post-expiry bids.

## Acceptance criteria

- [ ] Two browsers see accepted bids/extensions/results consistently.
- [ ] Guest/producer watching and buyer card/session restrictions match the API.
- [ ] Rejected bids explain the actual reason and never show optimistic winning state.
- [ ] Reconnect, out-of-order events and route changes do not duplicate/degrade state.
- [ ] Countdown is readable with reduced motion; keyboard and all screen ranges work.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Watch and bid from two windows, trigger one extension, reconnect and observe the winner order. Check guest/producer restrictions and responsive/keyboard UI.

## Delivery notes

Implemented the public auction list (state filter and page in the URL) and the
live room at `/auctions/$auctionId`, a producer-page auctions section, header
navigation and public-room links from producer auction screens. The room merges
revision-ordered socket and HTTP snapshots, anchors the countdown to server
time, rejoins and refetches on reconnect, retries a bid with the same request ID
after a lost acknowledgement, and shows persisted settlement results. Small API
additions: `GET /api/auctions/{id}/live` (state and `serverTime`), buyer-only
`GET /api/auctions/{id}/result`, which links the winner to their own order and
never exposes order/payment IDs publicly, and a producer filter on the public
list.

- Reviewed implementation: `10d1779`. Parent: PR #43 at `8cc45c3` (includes the 029 visual polish follow-up).
- Orchestration started in Codex (`gpt-6-luna` High executor) and was handed
  over mid-review to Claude Opus 5.5 as frontier with a Sonnet 5.5 builder.
  Frontier verdict: APPROVED after one formal correction round, which moved the
  bid panel before secondary details below 1280px, shows the viewer count as
  unavailable while disconnected, and adds a stale bid-history notice with
  retry. Usage/cost measurements unavailable.
- Passed: API and web typecheck, `pnpm contract:check`, root lint, web build
  with React Compiler verification, scoped Prettier and `git diff --check`.
  The bundle-size advisory remains. No full automated suite was run.
- Real Chrome/Mongo/Redis/API run (`demos/ticket-030-review/review-browser.ts`)
  passed two-buyer bidding, deadline extension, lost-acknowledgement retry
  without duplicates, reconnect recovery, missing/expired/removed card refusals,
  settlement with the winner's paid collection order, non-winner and no-bid
  results, buyer-only result access, invalid room IDs and no overflow at 390,
  900 and 1440 pixels. Screenshots are in `demos/ticket-030-review/`; images
  from before the correction round are in `before-round1/`.
- The stale-history notice was reviewed in code only; the fixture does not
  force a history refetch failure.
- Excluded unrelated dirty work: build skill and frontend reference, ticket
  index, order UI refactor and its `index.css` tokens.

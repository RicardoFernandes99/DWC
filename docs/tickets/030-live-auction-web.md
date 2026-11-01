# 030: Watch and bid in public live auction rooms

- Macro: M05
- Status: Draft
- Depends on: 006, 014, 025, 027, 028, 029
- PR: Not opened
- Branch / parent: Not assigned
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

Not implemented. Record actual evidence and PR/stack metadata here.

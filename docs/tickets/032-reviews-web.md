# 032: Display producer reviews and collect completed-order feedback

- Macro: M06
- Status: Draft
- Depends on: 014, 021, 031
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Visitors read real producer ratings/reviews; buyers review eligible orders and
signed-in users can report content.

## Read first

[Reviews](../product-decisions.md#notifications-and-reviews),
[web guidance](../../apps/web/AGENTS.md), producer/order UI and API 031.

## Scope and contract

- Add public producer rating summary and paginated reviews with empty/loading/error
  states; no invented ratings for producers without visible reviews.
- Completed buyer-order detail exposes a 1-5 star/optional-comment form when no
  review exists. Server eligibility/conflict is authoritative after submission.
- Use accessible radio/button semantics for stars, textual labels and visible
  focus. Do not rely on color/hover to communicate selection.
- Add authenticated report reason action with pending/success/error feedback.
  Display comments as text; do not inject stored HTML.
- Refresh public review/rating queries after accepted feedback. A hidden review
  disappears on refresh; do not expose moderation reports on public pages.
- No producer response, review editing or moderation UI outside the Laravel tickets.

## Acceptance criteria

- [ ] Both delivered and collected orders offer one valid review flow.
- [ ] Duplicate/foreign/ineligible API refusals show useful errors, not fake success.
- [ ] Public rating/count agrees with visible reviews and handles no reviews.
- [ ] Report action requires sign-in and handles duplicate submissions.
- [ ] Stars, comments and pagination work by keyboard at all responsive ranges.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Read/create/report a review in a browser and try a duplicate submission. Check accessible stars, plain-text comments and responsive layout.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

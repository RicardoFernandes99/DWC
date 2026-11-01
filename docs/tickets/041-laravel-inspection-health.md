# 041: Inspect marketplace records and health in Laravel

- Macro: M08
- Status: Draft
- Depends on: 037, 038
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

Administrators inspect users, orders, auctions and service health from read-only
backoffice pages.

## Read first

[Admin scope](../product-decisions.md#laravel-administration-and-suspension),
backoffice guidance from 038 and inspection API 037.

## Scope and contract

- Add bounded, server-paginated lists/detail with the filters supported by 037.
  Follow order/auction/user links through validated IDs and safe routing.
- Show historical line amounts, delivery fees, refund states and linked auction
  settlement without recomputing them from current product prices.
- Add service-health view using sanitized dependency status, refresh/error handling
  and readable last-check time. Do not expose raw configuration or logs.
- All pages remain admin-only, read-only and API-driven. No repair-state buttons,
  exports, impersonation or speculative admin analytics.
- Preserve normal order/auction vocabulary for both fulfilment methods and cancelled
  orders; unknown/new API state should fail visibly rather than be cast silently.

## Acceptance criteria

- [ ] Admin finds correct records across pagination/filter/navigation.
- [ ] Store/auction/refunded orders show accurate snapshots and related IDs.
- [ ] Health degradation is visible with no secret leakage or endless spinner.
- [ ] Non-admin/expired-session access and API errors are handled consistently.
- [ ] Read-only pages remain usable on all screen ranges and by keyboard.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Use backoffice static checks and inspect representative records plus a degraded health state. Confirm these screens do not send domain write requests.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

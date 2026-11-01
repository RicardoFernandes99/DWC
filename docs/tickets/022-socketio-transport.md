# 022: Authenticate Socket.io sessions and isolate personal rooms

- Macro: M06
- Status: Draft
- Depends on: 003
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

NestJS can deliver authenticated personal events without leaking one user's data
to another. This becomes the transport for the inbox and later public auctions.

## Read first

[Socket.io decisions](../product-decisions.md#auctions),
[API guidance](../../apps/api/AGENTS.md), auth/session services and existing bootstrap.

## Scope and contract

- Add compatible NestJS Socket.io gateway dependencies with the first notification
  consumer in mind. Use the existing API process/HTTP server and configured origin.
- Authenticate connections with the access JWT using the same current Redis
  session/user checks as HTTP. Join server-derived `user:<id>` rooms; never accept
  an arbitrary client-requested personal room or user ID as authority.
- Expired/revoked sessions cannot receive private events indefinitely: revalidate
  before private dispatch and disconnect/reject stale sessions. Handle Redis outage
  without leaking events or treating it as authenticated success.
- Provide a narrow personal-event publisher used by 024. No generic event bus,
  public auction rooms, notification persistence, queue or multi-instance adapter.
- Document handshake/errors/event naming in an event contract linked from docs.
  Socket transport is complementary to OpenAPI, not described as REST routes.

## Acceptance criteria

- [ ] Valid buyer/producer sessions connect; missing, altered and expired JWTs fail.
- [ ] Two accounts cannot join/receive each other's personal events.
- [ ] Logout/revocation and Redis failure prevent subsequent private delivery.
- [ ] Disconnect/shutdown cleans subscriptions and does not hang the API.
- [ ] Existing HTTP health/auth behavior remains intact.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Connect two local users, confirm private-room isolation and revoke one session. A short local socket client is sufficient; no transport test framework is required.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

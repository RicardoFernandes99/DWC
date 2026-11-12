# 022: Authenticate Socket.io sessions and isolate personal rooms

- Macro: M06
- Status: In review
- Depends on: 003
- PR: https://github.com/RicardoFernandes99/DWC/pull/36
- Branch / parent: `codex/age-022-socketio-transport` / `codex/route-guards` at `ce62e589bbf22b0c25959bbe3719ec2fb8c61b31`
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

- [x] Valid buyer/producer sessions connect; missing, altered and expired JWTs fail.
- [x] Two accounts cannot join/receive each other's personal events.
- [x] Logout/revocation and Redis failure prevent subsequent private delivery.
- [x] Disconnect/shutdown cleans subscriptions and does not hang the API.
- [x] Existing HTTP health/auth behavior remains intact.

## Checks

Follow [lightweight verification](README.md#lightweight-verification). The
repeatable real-socket check is `node apps/api/scripts/realtime-review.ts` after
an API build; it uses an ephemeral listener and unique MongoDB database, then
removes only the users and Redis session keys it created.

Connect two local users, confirm private-room isolation and revoke one session. A short local socket client is sufficient; no transport test framework is required.

## Delivery notes

Implemented with typed server/client event maps and an exported
`PersonalEventPublisher`. The `notification.created` payload contains only the
persisted inbox ID. See the [Socket.IO contract](../socket-events.md).

Checks passed: API typecheck/build, root tools and workspace typecheck, root lint,
scoped Prettier check, OpenAPI contract drift check, standalone strict typecheck
of the review script, and the real-socket review. It confirmed buyer/producer
handshakes, missing/altered/expired JWT
refusals, polling CORS headers and WebSocket-only mismatched-Origin rejection,
two-account isolation including an arbitrary room-join attempt, logout
revocation, no private event after the API's Redis client failed, and active
socket disconnection with bounded app shutdown. HTTP health, login and logout
also passed. The Redis-failure evidence shuts down only this review API's Redis
client; it does not interrupt the shared Redis service. The registry and
delivery are local to one API process. A logout racing between session check
and synchronous socket emit can overlap one event, as described in the contract.

Frontier verdict: APPROVED after one correction round. Reviewed implementation/check revision: `30c010b896fc8debe392e570d89d28b862490491`, compared only against parent PR #35 at `ce62e589bbf22b0c25959bbe3719ec2fb8c61b31`. Published ready for review through native `gh stack` in stack #34. Not merged.

The review script also passes this standalone strict typecheck:
`pnpm exec tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --experimentalDecorators --emitDecoratorMetadata --esModuleInterop --skipLibCheck --types node apps/api/scripts/realtime-review.ts`.

Build note: Luna High builder; 1 formal correction round (the root tools
typecheck exposed source imports that pulled decorated DTOs into the tools
program; the script now uses generated OpenAPI types and always closes its app
in `finally`); usage data unavailable.

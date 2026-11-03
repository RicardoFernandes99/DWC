# 024: Notify users about producer decisions, orders and refunds

- Macro: M06
- Status: In review
- Depends on: 009, 019, 020, 022, 023
- PR: https://github.com/RicardoFernandes99/DWC/pull/38
- Branch / parent: codex/age-024-order-approval-notifications / codex/age-023-inbox-api
- Blockers: None beyond dependencies

## Outcome

Real application events create persistent inbox records and live personal events
for the correct buyer or producer.

## Read first

[Notifications](../product-decisions.md#notifications-and-reviews),
services from 009/017/019/020, inbox 023 and Socket.io contract 022.

## Scope and contract

- Integrate approval/rejection decisions, new producer orders, fulfilment updates,
  buyer refund requests and producer refund decisions with inbox creation.
- Record inbox entries in the same transaction as business state where possible,
  then emit safe notification IDs/public payloads to recipient rooms after commit.
- Use stable source-event IDs so retries do not duplicate inbox entries. Concurrent
  status/refund operations still obey their existing acceptance predicates.
- A socket dispatch failure must not roll back or repeat an already committed order
  or refund. Inbox/reconnect fetch recovers missed live delivery; document this
  persistence-to-delivery gap rather than adding a queue for guaranteed toasts.
- No auction events yet; 028 uses the established publisher and inbox service.
  Notification payloads never contain card/auth data or unrelated application details.

## Acceptance criteria

- [x] Each listed source event persists for its intended recipients.
- [x] Online users receive it live; offline users find it on later inbox fetch.
- [x] Rolled-back/refused writes generate no success event/inbox record.
- [x] Retried writes do not duplicate notifications or business effects.
- [x] Unavailable sockets do not turn a committed business operation into a retry loop.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Perform one approval, order transition and refund decision while the recipient is online/offline. Confirm persisted inbox recovery without a dedicated e2e suite.

## Delivery notes

Parent: [PR 37](https://github.com/RicardoFernandes99/DWC/pull/37) at
`fede4e649fbf4e74a296dac8752c682f68d988cd`. Builder: `gpt-6-luna`, high effort;
formal correction rounds: 1; model adaptation: none; token/credit usage:
unavailable. Frontier verdict: APPROVED after final diff review and passing
checks. The correction replaced new double assertions in existing test fixtures
with concrete notification services/models and a narrow publisher dependency.
Existing web redesign, shared documentation, build skill and demo changes remain
excluded and unstaged.

Implemented on `codex/age-024-order-approval-notifications`, stacked on
`codex/age-023-inbox-api`. Approval/rejection, checkout orders, fulfilment
transitions, refund requests and refund decisions/direct cancellation persist
their inbox record in the business transaction. Stable source keys use decision
or order revisions. After commit, only the persisted notification ID is sent
through the process-local Socket.IO publisher; sync throws and rejected dispatch
promises are contained.

Verified with API and Web typechecks, API build, root lint, scoped Prettier, test TypeScript
check, contract check and 18 existing checkout quote/order tracking tests.
Runtime HTTP and authenticated WebSocket verification covered recipient
delivery/isolation, offline inbox recovery, refusals, retries and repeated refund
cycles, direct cancellation, sync/async publisher failures, notification-write
rollback, and a transaction callback retry. A process failure after MongoDB
commit but before socket dispatch can miss a live toast; inbox fetch/reconnect
recovers the persisted notification. No delivery queue is introduced. Runtime
verification used an ephemeral local API port, real MongoDB/Redis and native
WebSocket connections. Only verifier-owned records and sessions were removed;
the temporary API and verifier were cleaned up. Injected synchronous and
asynchronous dispatch failures did not change committed responses. A retryable
transaction error after inbox insertion produced two callback attempts and one
committed notification/live event.

Reviewed implementation revision: `4ca8162d16bc7292c363e9d99f6cf3288642254f`.
Published ready for review as [PR 38](https://github.com/RicardoFernandes99/DWC/pull/38)
through `gh stack submit --auto --open` in stack 34. No merge was performed.

Passed commands with Node 24.19.0 and pinned pnpm 11.25.0:

- `pnpm --filter @dwc/api typecheck` and `pnpm --filter @dwc/api build`.
- `pnpm --filter @dwc/web typecheck` and `pnpm lint`.
- `pnpm --filter @dwc/api exec tsc -p tsconfig.test.json --noEmit`.
- `pnpm --filter @dwc/api exec node --test test/order-tracking.test.ts test/checkout-quote.test.ts`, 18 passed.
- `pnpm contract:check` and `pnpm exec prettier --check` on the 11 ticket files.
- `node --env-file=.env .temp/ticket024-verify.ts`, temporary runtime verifier removed after cleanup.

Runtime verification is focused evidence, not proof of every possible concurrent
interleaving. Existing Mongoose `new` option deprecation warnings remain.

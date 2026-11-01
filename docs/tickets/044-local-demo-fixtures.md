# 044: Create repeatable non-destructive marketplace demo fixtures

- Macro: M01-M08 integration
- Status: Draft
- Depends on: 020, 028, 031, 035, 036
- PR: Not opened
- Branch / parent: Not assigned
- Blockers: None beyond dependencies

## Outcome

The school demonstration and integration checks can start from coherent local
accounts/products/orders/auctions without wiping personal development data.

## Read first

[Scope/evidence](../project-scope.md#delivery-evidence),
[local development](../../.agents/skills/local-development/SKILL.md),
implemented schemas/services and existing `apps/api/scripts/smoke.ts` conventions.

## Scope and contract

- Add an explicit TypeScript fixture command using a dedicated marker/namespace,
  deterministic relationships and idempotent re-runs. Never drop collections,
  reset databases, clear Redis globally or delete Docker volumes.
- Include buyers, pending/approved/rejected/suspended producers, searchable products,
  low-stock examples, both fulfilment flows, refund cases, reviews and upcoming/
  active/finished auction examples. Use dummy card metadata and generated/local
  test credentials only; never print or commit real secrets.
- Arrange records through valid domain services or narrowly documented fixture-only
  setup, not production auth bypasses. Start auction timing relative to server time;
  no browser-clock freezing. Make fixture image ownership/cleanup explicit.
- Document how to run and remove only fixture-owned data in dependency order. If
  live user data references fixture records, refuse unsafe cleanup instead of
  deleting those users' history. Keep generated media under demos/ when requested.
- Do not record a video or generate a report as part of this ticket.

## Acceptance criteria

- [ ] Fresh fixture run produces coherent visible flows with no fabricated features.
- [ ] Re-running does not duplicate accounts, inventory, payments or bid history.
- [ ] Unrelated local records/objects/keys remain untouched on create and cleanup.
- [ ] Fixtures respect stock conservation, roles, approval and order snapshots.
- [ ] Credentials/card metadata are demonstrative and no real secret is committed.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Run the fixture command twice on local data, inspect a few coherent records and clean only its namespace while preserving an unrelated record. No end-to-end test suite is required.

## Delivery notes

Not implemented. Record actual evidence and PR/stack metadata here.

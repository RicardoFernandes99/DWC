# 044: Create repeatable non-destructive marketplace demo fixtures

- Macro: M01-M08 integration
- Status: In progress
- Depends on: 020, 028, 031, 035, 036
- PR: Not opened
- Branch / parent: `codex/age-044-local-demo-fixtures` / PR 57 (`36fb266a2e31c48118ed6de517129e84c07e90f1`)
- Blockers: None

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

- [x] Fresh fixture run produces coherent visible flows with no fabricated features.
- [x] Re-running does not duplicate accounts, inventory, payments or bid history.
- [x] Unrelated local records/objects/keys remain untouched on create and cleanup.
- [x] Fixtures respect stock conservation, roles, approval and order snapshots.
- [x] Credentials/card metadata are demonstrative and no real secret is committed.

## Checks

Follow [lightweight verification](README.md#lightweight-verification).

Run the fixture command twice on local data, inspect a few coherent records and clean only its namespace while preserving an unrelated record. No end-to-end test suite is required.

## Delivery notes

Frontier APPROVED on 2026-11-06 after one correction round. Executor:
`gpt-6-luna` at High, unchanged throughout. Token/cost measurements were not
available. Parent verified live at `36fb266a2e31c48118ed6de517129e84c07e90f1`.

The explicit fixture command checks the local target and stopped API before
building. It inserts 35 schema-validated historical records plus a deterministic
ownership manifest in one transaction. Reruns preserve existing demo interactions.
Cleanup checks incoming and outgoing references, tolerates missing owned rows,
and removes only manifest-owned records and the ignored generated credentials.
Images are omitted; the command creates no Redis sessions or S3 objects.

Real checks used Node 24.19.0, pinned pnpm 11.25.0 and local MongoDB/Redis/Floci.
Two creates left every fixture record and credential unchanged. Stock accounting,
checkout/order/payment totals, delivery addresses, name snapshots, refund
allocations and auction lot pricing were inspected. Unrelated domain records were
compared by hashes, and unrelated Redis and S3 sentinels survived create/cleanup.
External review reports and an owned auction pointing to an outside user both
refused cleanup without deletion. A missing fixture card caused rerun refusal;
cleanup then removed the remaining namespace, manifest and credentials. A second
cleanup did nothing. Non-local targets and a running API refused before build.

All six accounts signed in through normal authentication. API reads showed the
four producer states, searchable products, two reviews, three orders per buyer,
all six receipt PDFs, the three auction states and the winning bid/order link.
Review login sessions and all temporary sentinels were removed. Local evidence
remains under `demos/ticket-044-review/`; no video or report was generated.

API and tooling strict typechecks, Nest build, scoped Prettier and root ESLint
passed. Local lint excluded only the inherited untracked
`demos/ticket-040-review/review.ts` failure and untracked `.pnpm-store/` artifacts.
No production endpoint or shared contract changed. Docker was updated by the user
after stale runtime sockets blocked startup; required checks passed after recovery.

---
name: plan
description: Break a substantial DWC feature or refactor into a short plan with scope, decisions, and verifiable phases.
---

# Plan a change

Read scope, architecture, affected app guidance and relevant code. Small changes
need only an inline plan. For work spanning sessions write
`.agents/work/<slug>/PLAN.md` with the observable outcome, expected files/boundaries,
real dependencies, assumptions and a few phases with checks.

Resolve uncertain domain behavior and consistency before UI polish. Use existing
commands and avoid speculative packages, deployment or formal process. Delegation
is optional and needs session authorization. Preserve unrelated changes.

When implementation is already authorized, continue with `execute`; writing a
plan is not another approval gate. Keep plans local by default. Durable decisions
can update existing scope/architecture docs without an ADR process.

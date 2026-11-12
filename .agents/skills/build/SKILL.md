---
name: build
description: Build a numbered DWC Markdown ticket with a frontier orchestrator, implementation agent, review-and-fix loop and a stacked ready-for-review PR. Use for build N, $build N or a request to build the next ticket. Not for running pnpm build alone.
---

# Build a ticket

Ingest ticket -> plan in chat -> selected builder implements -> frontier reviews
and requests fixes until approved -> open a ready-for-review stacked PR.

One invocation builds one ticket. Invoking this workflow authorizes its scoped
implementation, commits, push and PR creation, not merging or unrelated changes.
Creating/editing this skill is not a request to start a ticket.

## Models and ownership

Use the active session's model and selected reasoning effort for orchestration
and review. Do not impose Medium on the orchestrator. Map Light to `low`.
The executor is selected separately to minimize total cost of accepted work.

- When running in Codex, default to `gpt-6-luna` as the executor. Choose `low`,
  `medium` or `high` reasoning effort according to the ticket's scope and observed
  results. High is the ceiling, not the default.
- When running in Claude Code, the session model (Opus) orchestrates and reviews;
  delegate implementation to one builder through the Agent tool with
  `model: "sonnet"` and continue it with SendMessage for correction rounds.
  The frontier may make trivial one-line fixes itself; record them.
- Consider `gpt-6.1-sol` at `low` as an executor alternative when cheaper models'
  extra reasoning, retries or review overhead may erase their price advantage.
  Do not assume either Sol Light or a cheaper model at High is always cheapest.
- State the chosen executor model/effort and reason before implementation.
  Diagnose environment/contract failures before adapting model or effort.
  Announce and record changes; never exceed High without user instruction.
- Compare completed tasks using total input, cached input, output/reasoning
  usage and applicable rates when exposed, including orchestration, handoffs,
  review and correction rounds. Mark unavailable measurements unavailable.
  Effort labels alone do not prove cost or quality. Learn across real tickets;
  do not reimplement a ticket just to benchmark configurations.

In Codex, for `spawn_agent`, use `fork_turns: "none"` with explicit `model` and
`reasoning_effort` and a compact self-contained handoff. If delegation or the
chosen configuration is unavailable, report it and ask for a supported fallback.
Keep architecture, review and Git/PR mutations with the orchestrator. The builder
edits/tests one scope. No concurrent editors or additional review swarm.
Preserve completed work and valid checks when adapting the executor. Record
model/effort, correction rounds, adaptation reasons and available usage in the
ticket's delivery notes.

## 1. Ingest

Resolve `build N` to the unique `docs/tickets/NNN-*.md`; a supplied ticket path is
also accepted. Plain `build` selects the lowest-numbered unfinished ticket with
met dependencies, unless the user names work to resume. Do not build every ticket.

Read root guidance, `docs/project-scope.md`, the ticket index's shared implementation
standards, the ticket and relevant sections of
`docs/product-decisions.md`. Inspect only the affected app guidance and necessary
source. Treat ticket dependencies as actual code requirements, not status labels:
an open ancestor PR can satisfy one if its implementation is present on the base.

Draft tickets can proceed after the orchestrator resolves their stated blockers
and checks their contract against current decisions. Do not invent unresolved
product choices. Mark a genuinely blocked ticket Blocked with the concrete reason.
For plain `build`, report skipped blockers and choose the next eligible ticket;
an explicitly requested blocked ticket does not silently become another ticket.

Check status, current branch, remote and GitHub PRs. Preserve existing changes.
Read [stacking.md](references/stacking.md) before branch/PR operations; use it for
parent selection, resuming, dirty checkouts and publishing.

## 2. Plan

Use DWC's `plan` skill for a few chat bullets: behavior, touched areas, dependency
contracts, implementation steps and lightweight verification from the ticket
index. Default to typecheck/lint/build and a short manual check, not mandatory
unit/e2e/smoke suites. Resolve only meaningful open
decisions with `grill-me`. Once clear, continue without a separate plan approval.

Write no PLAN.md/STATE.md, research folders, tickets or ADRs as side effects.
The ticket is the durable record. Mark it In progress when implementation starts.

For frontend work, read [frontend skill selection](references/frontend.md).
Name the selected design and implementation skills, what each contributes and
the screens/states to inspect. Carry those choices into the builder handoff.

## 3. Execute through the builder

Send one handoff containing:

- Repository path, ticket path, current branch and verified base commit.
- Outcome, acceptance criteria, affected paths and relevant guidance/skills.
- Established dependency contracts and decisions; flag suggested new file names.
- Out-of-scope work, checks to run and available runtime/services.
- Stop conditions: conflicting contracts, missing product decisions, changes
  outside scope or a check still failing after a reasonable fix and retry.
- Return format: changed files, concise behavior summary, exact check results,
  limitations and questions. No commits, branch switching, pushes or GitHub writes.

Let the builder read the ticket itself instead of copying the entire chat/PDF.
Use the existing checkout. Scope changes require the orchestrator's decision.
The builder follows app skills for schemas, UI, security and meaningful tests.
Keep code modular and concise ("less is more"): reuse OpenAPI-generated types via
typed request helpers (`authenticatedRequest<T>`, `publicRequest<T>`) instead of
boilerplate per-field response type guards, reuse shared formatters/constants in
`src/lib/`, and split reusable cards (`components/shared/`) and feature subcomponents
(`features/<name>/components/`) into focused files rather than monolithic screens.

## 4. Frontier review and corrections

Review the actual diff against the selected parent, plus uncommitted/untracked
ticket files, and inspect the critical implementation. Parent PR changes are
context, not this ticket's review diff. A builder's summary is evidence, not an
approval. Check acceptance, authorization/concurrency risks, scope and test results.
For UI work, follow the [frontend visual review](references/frontend.md#visual-review)
alongside behavior checks. Inspect the rendered composition in all three screen
ranges, fix concrete findings, and provide before/after evidence for changed
existing screens. Capturing screenshots alone does not establish visual approval.

Give a concrete verdict in chat:

- `CHANGES REQUESTED`: file/line, observed problem, expected behavior and a check
  that will demonstrate the fix. Send this bounded list to the same builder unless
  an announced executor model/effort change is justified by observed results. Preserve the handoff
  and current diff when changing builders; do not restart completed work.
  Review its new diff and affected checks; repeat as needed.
- `APPROVED`: all required acceptance criteria have evidence, no blocking findings
  remain and required checks passed on the reviewed implementation revision.
  Reuse valid check results; rerun those invalidated by subsequent changes.

Allow at most three correction rounds per invocation. If still failing, stop
with ticket status Blocked, retain the work and summarize remaining failures.
Announce and record any model change; it does not reset the three-round limit.
Ask only if proceeding needs a scope change, an unavailable model/fallback or
additional rounds beyond that limit.

An unavailable required runtime/check is a verification blocker, not a pass.
Diagnose/fix local setup within authorization first. If required behavior still
cannot be verified, record the limitation and stop before opening a new PR or
claiming approval. Existing PRs stay open; report their unresolved state.

## 5. Publish

Only after frontier approval, follow the publishing section of
[stacking.md](references/stacking.md). Use a title such as
`Age 1 - Auth registration API` or `Age 2 - Backend Redis integration`, where the
number is the ticket/build ID. Update the existing PR when resuming.

Record status In review, PR URL, branch/parent, frontier verdict and actual check
evidence in the ticket. Report the PR link, parent PR/main, builder model and any
limitations. Done is reserved for merged work. Never merge automatically.

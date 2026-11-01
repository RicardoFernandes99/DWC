---
name: build
description: Build a numbered DWC Markdown ticket with a frontier orchestrator, cheaper implementation agent, review-and-fix loop and a stacked ready-for-review PR. Use for build N, $build N or a request to build the next ticket. Not for running pnpm build alone.
---

# Build a ticket

Ingest ticket -> plan in chat -> cheaper builder implements -> frontier reviews
and requests fixes until approved -> open a ready-for-review stacked PR.

One invocation builds one ticket. Invoking this workflow authorizes its scoped
implementation, commits, push and PR creation, not merging or unrelated changes.
Creating/editing this skill is not a request to start a ticket.

## Models and ownership

- The baseline orchestrator and reviewer is `gpt-6.1-sol` at `medium` reasoning.
  A skill cannot change the main chat's model. If the active model cannot provide
  the requested frontier review, explain that before implementation.
  Use the active frontier model; do not spawn a second Sol just to coordinate.
- Select implementation effort from this baseline rather than always using High:

| Work                                                                         | Model                                              | Reasoning |
| ---------------------------------------------------------------------------- | -------------------------------------------------- | --------- |
| Straightforward forms, DTOs, tests and small changes                         | `gpt-6-luna`                                       | `medium`  |
| Bounded feature implementation with several failure cases                    | `gpt-6-luna`                                       | `high`    |
| UI/browser work and scoped fixes being evaluated                             | `gpt-6.1-terra`                                    | `medium`  |
| Refresh-token concurrency, auction settlement and difficult correctness work | `gpt-6.1-sol`, or split into smaller builder tasks | `medium`  |

- For difficult work, prefer bounded cheaper tasks with Sol resolving the hard
  correctness decisions. If Sol implements a critical part directly, state that
  exception instead of claiming it was delegated to a cheaper model.
- Explicitly select the model and effort in the available delegation API.
  For this session's `spawn_agent`,
  use `fork_turns: "none"` with `model` and `reasoning_effort` so the builder does
  not inherit the frontier model or the full conversation. Supply a compact
  self-contained handoff. User-specified model overrides take precedence.
- On another client, use its supported cheaper-model selection, not a fabricated
  model alias. If delegation/model selection is unavailable, report the limitation
  and ask for the missing selection or a single-model fallback; do not silently
  run implementation on the expensive driver while claiming cheaper delegation.
- Keep architecture, ambiguity resolution, planning, review and Git/PR mutations
  with the orchestrator. The builder edits/tests one assigned scope. No concurrent
  editing agents, second provider or additional review swarm by default.

State the chosen model/effort and reason before implementation. This is a starting
baseline, not a proven cheapest configuration. Adapt within these model choices
when actual failed tasks, repeated corrections or observed usage justify it.
Diagnose environment/contract problems before increasing model effort. Keep
handoffs small and reuse valid verification; do not compare models by implementing
the same ticket several times just to benchmark them.

Record model/effort, correction rounds and a short reason for any change in the
ticket's delivery notes. Include token/credit usage only when the client exposes
it; otherwise record it as unavailable. Do not infer savings from effort labels
or treat token count alone as cost across different models. Changes to this
baseline itself should follow observed outcomes and the user's preferences.

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

## 4. Frontier review and corrections

Review the actual diff against the selected parent, plus uncommitted/untracked
ticket files, and inspect the critical implementation. Parent PR changes are
context, not this ticket's review diff. A builder's summary is evidence, not an
approval. Check acceptance, authorization/concurrency risks, scope and test results.
For UI work inspect real behavior and the agreed responsive ranges when required.

Give a concrete verdict in chat:

- `CHANGES REQUESTED`: file/line, observed problem, expected behavior and a check
  that will demonstrate the fix. Send this bounded list to the same builder unless
  a justified model change within the baseline is needed. Preserve the handoff
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

---
name: plan
description: Outline a DWC change as short implementation bullets in chat, identifying scope, useful checks, and only the open decisions that need the user.
---

# Plan in chat

Read the task, prior decisions, scope and relevant code. Show a short bullet list
in the conversation: intended behavior, the few implementation steps, and the
checks that will establish it works. Mention affected areas or dependencies only
when they help explain the work. Tiny fixes do not need a separate planning step.

Answer codebase questions by inspecting code. For meaningful unresolved product
or architecture choices, use `grill-me`: one question at a time, with a concrete
recommendation. Keep assumptions distinct from agreed decisions. Do not turn
routine choices into blockers or repeat questions already answered.

After questions are settled, update the bullets in chat. If implementation is
already authorized, continue directly; if the user only asked to plan, finish
with the plan. No `execute`, `verify`, `finalize`, build/delivery orchestration or
separate approval ceremony is required. Implementation includes sensible checks
and a brief report of what changed and what actually ran.

Do not generate PLAN.md, STATE.md, workflow folders, tickets or ADRs. Save a plan
only when the user explicitly requests a file, using the chosen location. Possible
future Markdown tickets are not part of the current workflow.

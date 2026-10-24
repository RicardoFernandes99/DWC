---
name: grill-me
description: Talk through a DWC feature or plan, challenge assumptions, and resolve open product or technical questions one at a time before implementation.
---

# Resolve open questions

Read `docs/project-scope.md`, relevant app guidance and the actual code first.
Use existing conversation decisions; do not make the user repeat them. Research
questions the repository can answer rather than asking the user to locate facts.

Ask one meaningful question at a time and wait for the answer. Explain the
concrete choice, give a recommended answer with a short reason, and offer a few
alternatives only when they help. Follow dependencies between decisions: settle
scope and ownership before details that depend on them. Use specific scenarios
(e.g. two buyers ordering the last unit) to expose ambiguity.

Challenge unclear words, missing failure behavior and conflicting assumptions,
without interrogating every routine implementation detail. Cover only what
matters for this task: outcome, scope, roles, data/consistency, edge cases and
how the user will know it works. If called from `plan`, focus on its open
questions rather than restarting the discussion.

Keep a compact running summary in chat of decisions and remaining questions.
Distinguish confirmed choices from recommendations, assumptions and deferrals;
silence is not agreement. Stop once the task is clear enough to implement, or
when the user says to stop, defer, or use your judgment. Resolve routine choices
with stated defaults when asked, while keeping genuinely blocked decisions open.

Finish with short bullets: agreed behavior/scope, important decisions, any open
or deferred questions and the next implementation steps. Feed these into `plan`
when useful. This is a planning conversation, not permission to implement unless
the user has also authorized that work.

Keep the result in chat by default. Save Markdown only when explicitly requested,
at the user’s chosen location; an existing requested plan can be updated there.
Do not create Notion pages, issues/tickets, ADRs, PLAN.md/STATE.md artifacts, or
mandatory approval stages. Markdown tickets may be introduced later if requested;
do not scaffold that system now.

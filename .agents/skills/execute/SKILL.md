---
name: execute
description: Implement or resume a DWC plan phase by phase, recording completed work and verification for later sessions.
---

# Execute a plan

Read the requested plan, current diff and app instructions. Establish completed
phases from code and checks, not only an old checklist. Implement the next ready
phase with `web-feature`/`api-feature`, then run its meaningful checks.

For multi-session work keep `.agents/work/<slug>/STATE.md` with completed phases,
checks actually run, remaining work and concrete blockers. Keep it brief.
Continue through authorized phases; ask only when a real decision or action needs
the user. Avoid cloud delivery and extra tooling. Delegation is optional and
requires session authorization. Finish with `verify` and scoped `finalize` cleanup.

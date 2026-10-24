---
name: finalize
description: Clean up the current DWC change after it works, removing experiments and updating relevant docs without broad refactoring or release ceremony.
---

# Finalize a change

Review this task's diff and its consequences. Remove its temporary logging,
unused experiments and abandoned code. Preserve unrelated changes and useful
historical comments. Do not broaden the cleanup to the rest of the repository.

Update existing setup/scope/architecture docs where behavior or commands changed.
Keep planned features distinguishable from implemented ones. No ADR, ticket,
formal release or PR-writing process is required.

Rerun relevant checks if cleanup changes behavior/configuration. If guidance
changed, verify shared skill discovery and `CLAUDE.md` imports. Keep useful state
for unfinished work; remove completed scratch only when no longer needed.
Report delivered behavior, checks and practical limits. Commit/push/publish only
as requested, not as automatic finalization.

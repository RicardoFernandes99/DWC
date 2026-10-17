---
name: review-change
description: Review a DWC change for regressions, authorization, validation, React Compiler compatibility, auction consistency, and sufficient tests. Use for code reviews and pre-merge verification.
---

# Review change

1. Read repository instructions and inspect the actual diff and surrounding
   callers. Identify intended behavior and affected app boundaries.
2. Prioritize correctness, ownership checks, invalid input, error states,
   credential handling, data loss and concurrent operations over style.
3. For Web, check accessibility, lifecycle cleanup, compiler lint diagnostics
   and server contracts. For API, check DTOs, status codes, OpenAPI, atomic
   state changes and storage access. Check setup/docs when commands change.
4. Run targeted existing checks. Use `pnpm check` for changes across the workspace
   and `pnpm smoke` for real-service integration when available. Do not describe
   skipped or unrun checks as passing.
5. Report actionable findings with file/line, triggering scenario and impact.
   Distinguish confirmed defects from assumptions. If no issue is found, say so
   and describe the limits of validation. Do not rewrite unrelated code.

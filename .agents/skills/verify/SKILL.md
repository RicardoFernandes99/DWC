---
name: verify
description: Verify DWC changes through focused tests, real API or browser behavior, and honest reporting of observed results and limits.
---

# Verify behavior

State the expected outcome from the task. Inspect available package scripts;
a missing filtered script is not a passing test.

- Logic: focused behavior/regression test.
- Web: interaction tests/build and a browser check for the changed flow.
- API: exercise the endpoint and a meaningful refusal.
- Storage/config: run the API/services and `pnpm smoke`.
- Stock/auctions: independent requests against real MongoDB proving contention,
  deadline rejection and commit-before-broadcast behavior.

Use app filters for `test`, `typecheck` and `build`. Root `pnpm lint` and
`pnpm format:check` do not use app filters. `pnpm check` covers the workspace.
Use isolated records; remove only test data you created. Browser mocks prove
client behavior, not authentication/database correctness. Use seeded real accounts
once auth exists; don't add a bypass to reach a page.

Use `record-demo` for visual evidence saved under `demos/`; overlays are not test
results. Report checks actually run, observations and unverified limits. Stop only
processes started for this task.

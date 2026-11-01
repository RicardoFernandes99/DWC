# Branches and stacked PRs

The user wants each new build stacked on the latest open feature PR, including
unrelated features. Ticket readiness still depends on actual prerequisites.

## Discover and resume

1. Resolve the repository/remote from Git and query live GitHub PR metadata using
   authenticated GitHub CLI (`gh`). Use `gh` for all GitHub reads/writes in this
   workflow; the user does not want ChatGPT Codex Connector attribution. Do not
   silently fall back to the connector. Get state, number, title, creation time,
   base/head refs, head SHA and URL. Missing access blocks stack selection and
   publication; do not guess from local branch names or an old chat.
2. First look for a PR/branch for this exact ticket using recorded metadata,
   `Age N -` title, ticket link or `codex/age-NNN-...` branch. Resume it rather
   than selecting it as its own parent. Conflicting matches need clarification.
   If it merged, reconcile ticket status; do not duplicate the completed feature.
   A closed unmerged PR is not an open dependency and must not be silently reopened.
   On resume, retain this PR's own branch/base rather than reparenting it onto its
   descendants. If corrections change an ancestor with open descendants, report
   those PRs as needing refresh/revalidation; do not rewrite or approve them as
   part of this ticket.
3. For a new ticket, select the most recently created open DWC feature-ticket PR,
   not the most recently updated PR. Draft feature PRs also count as open.
   Exclude dependency bots, maintenance and non-feature PRs. Prefer recorded ticket
   links/branch metadata; use title only as supporting evidence. If classification
   is ambiguous, clarify rather than silently using main or a guessed parent.
4. If that PR has an open descendant, use the newest descendant tip. Reject cycles
   or inconsistent metadata. If no eligible open feature PR exists, use remote
   `main`. A Draft/In review dependency is usable only when its required code is
   actually present in the selected ancestry. Do not cherry-pick missing work or
   put an older ticket on a descendant that already contains it.
5. Fetch the verified parent branch and record its SHA. Use that tip as the new
   `codex/age-NNN-short-description` branch base. The PR targets that parent branch,
   not main. When parent is main, target main.

## Preserve the checkout

Inspect staged, unstaged and untracked files before switching branches. Use the
existing checkout, never create a worktree unless the user requests one. Do not
reset, clean, discard, auto-stash or sweep existing edits into the ticket commit.

If pre-existing changes belong to the requested ticket and have an unambiguous
base, include them deliberately and inspect their diff. Unrelated changes may
remain only when checkout/verification/commit isolation is demonstrably safe.
If they overlap, prevent a safe base switch or contaminate required evidence,
stop and name the concrete conflict. Ask how to preserve/commit the outstanding
work; do not create an unrelated foundation commit without authorization.

Uncommitted prerequisites, including local Redis infrastructure, do not become
available on a fresh branch merely because they exist in the current working tree.

## Publish after approval

- Verify live parent/own-PR state again before publishing. If the parent moved or
  merged during implementation, reconcile the current branch and review the
  resulting ticket-only diff. Rerun checks affected by reconciliation. Do not
  publish approval for a revision that changed afterward without re-review.
- Compare against the actual parent, not `main`, to exclude earlier tickets from
  the PR diff. Stage only ticket-owned files/hunks and ticket metadata. Inspect the
  staged diff before committing; never use an indiscriminate `git add .`.
- Push the ticket branch and create a ready-for-review PR using the verified
  parent. Reuse a matching existing PR and preserve its discussion. Title format:
  `Age N - <short feature summary>`, for example `Age 1 - Auth registration API`.
  Age numbering follows ticket IDs, not the count of currently open PRs.
- Body: concrete outcome, ticket link, parent PR/main, checks/results and important
  limitations. Use the repository template if present. Include only useful review
  evidence, not builder transcripts or the full plan. Do not mark checks passed
  from expectation. For CLI multiline bodies use a body file.
- Once the PR exists, record its actual URL, branch/parent, check evidence and
  frontier verdict in the ticket and push the metadata update. This doc-only
  update needs a diff check, not a repeat of unchanged runtime checks. If PR
  creation/push fails, retain local work, report the failure and do not claim
  status In review without an actual open PR.
- Never merge or rebase other ticket owners' work. When a parent merges, fetch and
  reconcile only this ticket's branch, using the recorded old parent SHA to avoid
  reintroducing squashed ancestor commits. If a history rewrite would be needed,
  do not force-push without authorization; explain the exact branch and need.

## Resume notes

Keep the selected parent SHA and review/check revision in the ticket's delivery
notes along with PR metadata. They identify what was reviewed and allow safe
stack reconciliation. Do not create parallel STATE.md files or mark a PR merged
merely because its parent merged. Merge order is bottom-up and remains the user's
decision.

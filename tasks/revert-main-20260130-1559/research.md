---
task: revert-main
timestamp_utc: 2026-01-30T15:59:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Revert main to 6e3eb7b

## Requirements

- Functional:
  - Return main branch contents to commit `6e3eb7b` ("Add privacy policy page and update redirect").
  - Use PR-based revert (no force-push) to satisfy branch protection.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve historical audit trail via revert commit.

## Existing Patterns & Reuse

- Branch protection requires PRs for changes to main.
- Prior commits after `6e3eb7b` include CI/workflow changes and app updates.

## External Resources

- N/A

## Constraints & Risks

- Large revert may remove unrelated fixes.
- Possible conflicts if files deleted/renamed after the target commit.

## Open Questions (owner, due)

- Q: Confirm that full revert to `6e3eb7b` is desired (not partial)?

## Recommended Direction (with rationale)

- Create a revert PR that resets repository content to the tree of `6e3eb7b` via `git checkout <commit> -- .` and commit, avoiding force-push while restoring the exact state.

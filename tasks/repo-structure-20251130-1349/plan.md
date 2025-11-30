---
task: repo-structure
timestamp_utc: 2025-11-30T13:49:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Repository Structure Documentation

## Objective

Document the repository's current directory structure in markdown files stored within the task folder for easy review.

## Success Criteria

- [ ] Top-level repository tree captured with sensible exclusions.
- [ ] `src` directory tree captured with useful depth and exclusions.
- [ ] Outputs saved as markdown files inside the task directory.

## Approach & Scope

- Use `tree` with ignore patterns for bulky/generated directories (e.g., `node_modules`, `.next`, `dist`, `coverage`, `.turbo`, `playwright-report`, `test-results`).
- Generate two views: repository root (depth 2) and `src` subtree (depth 3).
- Keep outputs in fenced code blocks for readability.

## Edge Cases

- If `tree` is unavailable, fallback to `find` with `sed` to format; document any deviation.

## Testing Strategy

- Manual inspection of generated markdown to ensure paths and exclusions look correct.

## Rollout

- Not applicable (documentation-only change).

## Notes

- No code or configuration changes planned.

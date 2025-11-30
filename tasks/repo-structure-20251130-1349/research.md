---
task: repo-structure
timestamp_utc: 2025-11-30T13:49:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Repository Structure Documentation

## Requirements

- Provide the current repository directory structure as markdown files.
- Save outputs within the task folder.
- Avoid unnecessary scope changes; no code or config modifications expected.

## Existing Patterns & Reuse

- Previous repository maps exist (`route-map*.md`, `route-map.json`) that demonstrate documenting structure; we can mirror the approach using CLI tooling.
- Use the `tree` command with sensible ignores to avoid huge outputs (e.g., `node_modules`, build artifacts).

## External Resources

- None required; relies solely on local repository state.

## Constraints & Risks

- Repository is large; full recursive output would be noisy. Limit depth and ignore bulky directories.
- Must adhere to AGENTS.md task structure and keep artifacts in the task folder.

## Open Questions (owner, due)

- Desired depth or exclusions? (owner: github:@assistant, due: upon review)

## Recommended Direction (with rationale)

- Generate two markdown files: a top-level tree (depth 2) and a deeper view of `src` (depth 3), excluding heavy directories.
- Store outputs in `tasks/repo-structure-20251130-1349/` for traceability.

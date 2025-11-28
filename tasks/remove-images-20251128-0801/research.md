---
task: remove-images
timestamp_utc: 2025-11-28T08:01:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove image assets

## Requirements

- Functional: Remove all image assets (png, jpg, jpeg, gif, webp, bmp, tiff, tif, ico, svg, heic) from the repository per user request.
- Non-functional: Keep non-image files untouched; avoid deleting `.git` internals or node_modules caches; ensure repeatability via task docs.

## Existing Patterns & Reuse

- No prior cleanup task located; will use shell find commands to enumerate and remove matching extensions.

## External Resources

- N/A — task is repository-local.

## Constraints & Risks

- Removing images may break UI or tests that expect assets; user explicitly requested full removal.
- Must avoid deleting files in `.git` and build caches to prevent corruption.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Inventory image files with `find` while excluding `.git` and `node_modules`.
- Remove matching files and record counts; keep list for verification.

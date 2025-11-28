---
task: remove-images
timestamp_utc: 2025-11-28T08:01:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove image assets

## Objective

Remove all image files (common raster and vector formats) from the repository per user request while leaving other assets untouched.

## Success Criteria

- [ ] All files with extensions png, jpg, jpeg, gif, webp, bmp, tiff, tif, ico, svg, heic are deleted outside `.git` and `node_modules`.
- [ ] Removal list captured for verification.
- [ ] No non-image files are removed.

## Architecture & Components

- Command-line `find` to enumerate and delete targeted extensions.
- Task documentation in `tasks/remove-images-20251128-0801/`.

## Data Flow & API Contracts

- N/A (file removal only).

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Hidden images (e.g., `.png` with leading dot) should be removed.
- Exclude `.git` and `node_modules` directories to avoid corruption or unnecessary deletions.

## Testing Strategy

- Manual verification: list remaining image files after deletion; expect none.

## Rollout

- One-time cleanup; no feature flag.

## DB Change Plan (if applicable)

- N/A.

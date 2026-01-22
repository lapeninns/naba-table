---
task: fix-skill-frontmatter
timestamp_utc: 2026-01-22T00:42:24Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm required frontmatter fields and limits from docs
- [x] Identify affected SKILL.md files

## Core

- [x] Add missing `description` fields in YAML headers (single-line)
- [x] Preserve existing skill content

## Tests

- [x] Manual header verification (fields + single-line length)

## Notes

- Assumptions:
  - Loader enforces required `name` and `description` fields.
- Deviations:
  - None.

## Batched Questions

- None.

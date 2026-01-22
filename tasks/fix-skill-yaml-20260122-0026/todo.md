---
task: fix-skill-yaml
timestamp_utc: 2026-01-22T00:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm affected skills list

## Core

- [x] Add missing `name` fields in YAML headers
- [x] Preserve existing skill content

## Tests

- [x] Manual header verification

## Notes

- Assumptions:
  - Skill loader only requires valid YAML with `name`.
- Deviations:
  - None.

## Batched Questions

- None.

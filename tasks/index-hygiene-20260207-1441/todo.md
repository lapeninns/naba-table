---
task: index-hygiene
timestamp_utc: 2026-02-07T14:41:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Preflight (staging)

- [ ] Run constraint-backing safety query for planned drops (must return 0 rows).
- [ ] Capture baseline counts for:
- [ ] Missing FK supporting indexes
- [ ] Duplicate groups (exact)
- [ ] Duplicate groups (ignoring uniqueness)

## Apply (staging)

- [ ] Run FK index creation section.
- [ ] Run redundant/duplicate index drops section.

## Verify (staging)

- [ ] Missing FK supporting indexes count = 0.
- [ ] Duplicate groups (exact) = 0 rows.
- [ ] Duplicate groups (ignoring uniqueness) = 0 rows.

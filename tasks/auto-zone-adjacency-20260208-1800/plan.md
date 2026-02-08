---
task: auto-zone-adjacency
timestamp_utc: 2026-02-08T18:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Auto “All-to-All Within Zone” Adjacency (Movable-Only)

## Objective

Enforce a single canonical merge policy:

- Movable tables within a zone are mergeable with each other.
- Fixed tables are never merge-eligible.
- Merged assignments require same non-null zone and adjacency.
- Planner prefers lower overage first, then fewer tables.

## Success Criteria

- [ ] `table_adjacencies` exists with canonical constraints (PK, CHECK, FKs CASCADE, index on table_b).
- [ ] DB triggers automatically maintain adjacency on eligible changes.
- [ ] Allocator/assignment cannot bypass adjacency.
- [ ] Cross-zone and null-zone merges are rejected.
- [ ] Unit tests cover ordering + zone enforcement + mobility semantics.
- [ ] Verification script validates adjacency graph correctness against DB.

## Architecture

- DB owns adjacency invariants via SECURITY DEFINER function + triggers.
- Application treats adjacency as required whenever selecting >1 table.

## Testing Strategy

- Vitest unit tests for selector ordering and zone enforcement.
- Read-only DB verification script for staging/prod.

## Rollout

- Apply migration staging first then prod.
- Deploy app changes after DB backfill.

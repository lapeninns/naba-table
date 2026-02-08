---
task: auto-zone-adjacency
timestamp_utc: 2026-02-08T18:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Auto Zone Adjacency (All-to-All Within Zone)

## Requirements

- Functional:
  - Adjacency is automatic: for each zone, eligible movable tables form a complete graph (all-to-all), stored as directed edges both ways.
  - Only movable tables are merge-eligible; fixed tables are never eligible for merges.
  - Merged plans are hard-restricted to same non-null zone.
  - Adjacency enforcement is mandatory for merges (no bypass, no fallback).
  - Ranking preference is strict: minimize wasted seats (overage) first, then minimize number of tables.

- Non-functional:
  - Production-safe: atomic updates where possible; DB-side enforcement via triggers.
  - Scales to ~<=30 movable tables per zone.
  - Single source of truth: zone + table properties determine adjacency.
  - Security: no secrets committed; RLS on adjacency table; SECURITY DEFINER functions with locked search_path.

## Existing Patterns & Reuse

- Existing adjacency reading: `server/capacity/table-assignment/supabase.ts` reads `public.table_adjacencies` into an in-memory graph.
- Existing manual generator: `scripts/build-zone-adjacency.ts` (currently write-oriented).
- Existing cache invalidation is already wired for inventory/adjacency.

## External Resources

- N/A (policy is internal); follow Supabase/Postgres best practices for SECURITY DEFINER + search_path.

## Constraints & Risks

- Schema drift: prod has `public.table_adjacencies` constraints; repo migrations must canonicalize in a safe, idempotent way.
- RLS/policies may affect reads; server must continue using service role.
- Any behavior change in allocator selection impacts ops outcomes; tests required.

## Open Questions

- None (policy locked).

## Recommended Direction

- Canonicalize `public.table_adjacencies` + add DB triggers to rebuild per zone.
- Remove adjacency-relaxing fallback and enforce strict zone rules in allocator.

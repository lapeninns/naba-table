---
task: auto-zone-adjacency
timestamp_utc: 2026-02-08T18:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Add Supabase migration to canonicalize `public.table_adjacencies` and add auto-rebuild triggers.
- [ ] Enforce adjacency required: remove fallback relax in quote.
- [ ] Enforce strict same non-null zone for merges (selector + assignment validations).
- [ ] Align movable semantics with deriveTableRules (null/adjustable treated as movable).
- [ ] Change selector ranking to strict: overage then tableCount.
- [ ] Add env var FEATURE_ADJACENCY_QUERY_UNDIRECTED and wire it.
- [ ] Add DB verification script (read-only).
- [ ] Add unit tests.
- [ ] Run: lint, typecheck, vitest.

## Notes

- Supabase remote-only.

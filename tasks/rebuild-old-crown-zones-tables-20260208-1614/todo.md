---
task: rebuild-old-crown-zones-tables
timestamp_utc: 2026-02-08T16:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Implement export enhancements (adjacencies + booking refs).
- [ ] Implement rebuild script with guards, artifacts, paging.
- [ ] Run `DRY_RUN=true` preflight and review artifacts.
- [ ] Run production apply with `CONFIRM_PRODUCTION=true`.
- [ ] Verify postflight invariants and capture artifacts.

## Status

- [x] Export enhancements implemented.
- [x] Rebuild script implemented (`scripts/rebuild-oldcrown-zones-tables.ts`).
- [x] Preflight run (artifacts written).
- [x] Production apply completed (via `RESUME=true` after partial attempt).
- [x] Postflight checks captured in `artifacts/postflight.json`.

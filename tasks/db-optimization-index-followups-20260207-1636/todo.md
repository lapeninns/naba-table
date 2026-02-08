---
task: db-optimization-index-followups
timestamp_utc: 2026-02-07T16:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Add migration `supabase/migrations/20260207170000_add_remaining_fk_indexes.sql`.
- [x] Apply to staging with `supabase db push --linked --yes`.
- [x] Verify staging is up-to-date: `supabase db push --linked --dry-run`.
- [ ] Capture post-apply FK index audit output in `verification.md`.

---
task: revert-staging-migration
timestamp_utc: 2026-02-08T15:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Capture `supabase migration list --linked` output
- [ ] Dump `supabase_migrations.schema_migrations` data-only
- [ ] Run `supabase db diff --linked` and save output
- [ ] Decide if schema drift exists and needs a revert migration
- [ ] If needed, write revert migration under `supabase/migrations/`
- [ ] `supabase db push --linked --dry-run`
- [ ] Apply to staging (linked)
- [ ] Re-run diff and record results

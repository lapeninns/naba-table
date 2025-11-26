---
task: reset-floorplan
timestamp_utc: 2025-11-25T23:54:26Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: s | LCP: s | CLS: | TBT: ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`

## DB Actions performed

- Migration: `supabase/migrations/20251126000000_enforce_bar_drinks_only.sql`
- Seed: `supabase/seeds/white-horse-service-periods.sql`
- Sanity queries: `tasks/reset-floorplan-20251125-2354/artifacts/sanity-queries.sql`

Backups & Rollback:

- If `pg_dump` was available when running the script, the backup was created in `backups/supabase-apply-order-<timestamp>/pre-apply.sql`.
- To rollback, use `scripts/restore_supabase_backup.sh` and apply that file to the target DB.

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

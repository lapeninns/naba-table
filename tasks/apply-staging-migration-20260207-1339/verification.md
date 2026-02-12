---
task: apply-staging-migration
timestamp_utc: 2026-02-07T13:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification

## Migration(s)

- `supabase/migrations/20260206213430_ops_email_delivery_attempts_dashboard.sql`

## Dry-run

- [x] Ran dry-run with transaction rollback
  - Log: `artifacts/staging_dry_run_psql.log`

## Apply

- [x] Applied to staging project `ndxmivcrehsacuerwxtm`
  - Log: `artifacts/staging_apply_psql.log`

## Post-apply checks

- [x] Index exists: `public.email_delivery_log_restaurant_occurred_at_id_idx`
- [x] Functions exist:
  - `public.ops_email_delivery_attempts_feed(...)`
  - `public.ops_email_delivery_attempts_summary(...)`
- [x] `service_role` EXECUTE granted on both functions
- [x] Smoke call: `ops_email_delivery_attempts_summary` returned `total=0` on a sample restaurant
  - Output: `artifacts/staging_post_apply_checks.txt`
- [x] RPC smoke via Supabase API succeeded (service role key)
  - Script: `node --import tsx scripts/staging/smoke-email-delivery-rpc.ts`
  - Output: `artifacts/email_delivery_rpc_smoke.txt`
  - Migration SHA256: `artifacts/migration_sha256.txt`
- [x] Manual QA: Ops Email Delivery page loads and API returns 200 (Chrome DevTools MCP)
  - Screenshot: `artifacts/ui_email_delivery_page.png`
  - Notes: `artifacts/ui_manual_qa_email_delivery.txt`

## Rollback SQL (if required)

```sql
drop function if exists public.ops_email_delivery_attempts_feed(
  uuid, text, integer, integer, text[], text, text, text, text, text
);

drop function if exists public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
);

drop index if exists public.email_delivery_log_restaurant_occurred_at_id_idx;
```

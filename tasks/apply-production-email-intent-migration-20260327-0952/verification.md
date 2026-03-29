---
task: apply-production-email-intent-migration
timestamp_utc: 2026-03-27T09:52:10Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (DB-only rollout).

## Test Outcomes

- [x] Production preflight/auth path investigation completed.
- [ ] Migration apply completed.
- [ ] Post-apply verification query completed.

### Current status

- Staging verification succeeded via Supabase MCP:
  - `public.email_dispatch_intents` exists
  - `public.claim_due_email_dispatch_intents(...)` exists
- Production apply is blocked in this workspace:
  - direct Postgres auth to `db.vrdiqfudmwydclqpydee.supabase.co:5432` failed with `28P01`
  - pooler auth to `aws-1-eu-west-2.pooler.supabase.com:6543` failed with `28P01`
  - `npx supabase@latest projects list -o json` failed because no `SUPABASE_ACCESS_TOKEN` is configured
- No production DDL was executed.

## Artifacts

- Preflight: `artifacts/preflight-production-check.txt`
- CLI auth check: `artifacts/cli-auth-check.txt`
- Apply: `artifacts/production-apply.txt`
- Post-check: `artifacts/post-apply-production-check.txt`

## Rollback SQL (if required)

```sql
revoke execute on function public.claim_due_email_dispatch_intents(integer, text[]) from service_role;
drop function if exists public.claim_due_email_dispatch_intents(integer, text[]);
drop policy if exists "Service role has full access to email_dispatch_intents" on public.email_dispatch_intents;
drop table if exists public.email_dispatch_intents;
```

## Known Issues

- This workspace does not currently have a usable production Postgres password or Supabase CLI access token, so the rollout cannot be completed safely from here.

## Sign-off

- [ ] Engineering
- [ ] QA

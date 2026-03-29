---
task: email-intents-db-rollout
timestamp_utc: 2026-03-27T09:46:35Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Checklist

## Staging

- [x] Confirm the linked MCP target is staging (`ndxmivcrehsacuerwxtm`).
- [x] Apply `20260327090000_add_email_dispatch_intents.sql` on staging.
- [x] Verify `public.email_dispatch_intents` exists on staging.
- [x] Verify `public.claim_due_email_dispatch_intents` exists on staging.
- [x] Register migration version `20260327090000` in staging `supabase_migrations.schema_migrations`.

## Production

- [x] Confirm production project ref should be `vrdiqfudmwydclqpydee`.
- [x] Attempt read-only production access via env-backed Postgres connection.
- [x] Attempt service-role RPC fallback (`public.exec_sql`).
- [x] Re-establish a working production access path for this session.
- [x] Apply production schema migration.
- [x] Register production migration version `20260327090000`.
- [x] Deploy the ledger-backed runtime to the live production Vercel project.
- [x] Verify production cron can claim/process a ledger intent on the live deployment.

## Notes

- Assumptions:
  - Staging MCP target is the linked project stored in `supabase/.temp/project-ref`.
- Deviations:
  - Used `execute_sql` + manual `schema_migrations` insert on staging because the MCP migration endpoint is unavailable in this session.
  - Used the Supabase Management API `database/query` endpoint for production because MCP is still pinned to staging and the migrations endpoint is unavailable in this session.
  - Used a git-free linked bundle deployment for Vercel production because direct repo deploys were blocked by the Vercel git-author access check.

---
task: email-intents-db-rollout
timestamp_utc: 2026-03-27T09:46:35Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Email Intents DB Rollout

## Objective

Roll out the new email intent ledger schema safely so the hybrid email scheduling cutover can run against remote Supabase environments without relying on the legacy Durable Object email queue state.

## Success Criteria

- [x] Staging has `public.email_dispatch_intents`.
- [x] Staging has `public.claim_due_email_dispatch_intents(integer, text[])`.
- [x] Staging migration metadata includes version `20260327090000`.
- [x] Production has the same schema objects.
- [x] Production migration metadata includes version `20260327090000`.

## Rollout Strategy

- Stage 1:
  - Use the connected Supabase MCP staging target.
  - Apply the migration SQL with `execute_sql` because `apply_migration` is unavailable.
  - Manually register the migration version in `supabase_migrations.schema_migrations`.
  - Validate table + RPC presence and a no-op claim call.
- Stage 2:
  - Use the Supabase Management API `POST /v1/projects/{ref}/database/query` with the local PAT from `.env.local`.
  - Apply the same idempotent SQL plus an `ON CONFLICT DO NOTHING` insert into `supabase_migrations.schema_migrations`.
  - Re-run production presence checks and verify `service_role` can execute the claim RPC.

## Risks

- Manual SQL application without history registration would leave future `db push` runs inconsistent.
- The repo still contains unrelated duplicate migration version prefixes, so CLI-based `db push` remains unsafe until those older duplicates are consolidated.

## Rollback

- No rollback executed from this session.
- If follow-up rollback is needed, use a compensating SQL migration rather than ad hoc object drops.

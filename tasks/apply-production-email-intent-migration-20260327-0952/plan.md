---
task: apply-production-email-intent-migration
timestamp_utc: 2026-03-27T09:52:10Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Apply Production Email Intent Migration

## Objective

We will apply the production email-intent ledger migration so the shipped hybrid cutover has its required database primitives in the live Supabase project.

## Success Criteria

- [ ] Production target is explicitly confirmed as `vrdiqfudmwydclqpydee`.
- [ ] Pre-apply checks show whether `email_dispatch_intents` and the claim RPC are missing or already present.
- [ ] Migration executes cleanly in production with recorded evidence.
- [ ] Post-apply checks confirm the table, indexes, policy, and claim RPC exist.
- [ ] Rollback SQL is documented in case immediate reversal is required.

## Architecture & Components

- Migration source:
  - `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`
- Runtime consumers:
  - `server/queue/email-intents.ts`
  - `src/app/api/cron/process-emails/route.ts`
  - `src/app/api/admin/queue-status/route.ts`
- Verification path:
  - guarded direct SQL from workspace using local env-backed credentials

## Data Flow & API Contracts

- No API contract changes in this rollout step.
- This rollout unlocks the already-merged codepath:
  - booking lifecycle writes intent rows
  - cron claims due rows through `claim_due_email_dispatch_intents`
  - shared email processor sends and marks outcome

## UI/UX States

- N/A (DB-only rollout).

## Edge Cases

- Objects already exist in production from a prior manual apply.
- Production credentials/env may point at the wrong project; the script must fail before applying.
- Connectivity may require SSL settings that differ from prior data-only scripts.

## Testing Strategy

- Read-only preflight query against production.
- Transactional migration apply.
- Read-only post-apply query confirming:
  - table exists
  - function exists
  - key indexes exist
  - service-role grant/policy exists

## Rollout

- Target envs: staging already verified, production apply in this task.
- Monitoring:
  - production cron/process logs after deploy/runtime traffic
  - email queue/admin visibility endpoints once the live app touches the new objects
- Kill-switch:
  - execute rollback SQL to drop the new function/table objects if the rollout must be reverted immediately

## DB Change Plan (if applicable)

- Target envs: staging verified via MCP -> production apply now
- Backup reference: Supabase-managed PITR/backups for production project `vrdiqfudmwydclqpydee` (assumed from hosting posture; not directly inspectable here)
- Dry-run evidence: preflight object snapshot in `artifacts/preflight-production-check.txt`
- Backfill strategy: none
- Rollback plan:
  - revoke/drop claim function
  - drop policy
  - drop table `public.email_dispatch_intents`

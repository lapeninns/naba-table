---
task: apply-production-email-intent-migration
timestamp_utc: 2026-03-27T09:52:10Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Apply Production Email Intent Migration

## Requirements

- Functional:
  - Apply `supabase/migrations/20260327090000_add_email_dispatch_intents.sql` to the production Supabase project.
  - Keep the rollout aligned with the already-merged hybrid email-intent cutover.
  - Verify the new table and claiming RPC exist after apply.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Supabase remains remote-only.
  - Avoid leaking DB credentials or service-role secrets in logs/artifacts.
  - Keep the rollout forward-only and low-lock.

## Existing Patterns & Reuse

- Current cutover task and migration source of truth:
  - `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`
  - `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`
- Existing production rollout runbooks/tasks:
  - `tasks/prod-db-rollout-20260208-0024/`
  - `tasks/apply-staging-migration-20260207-1339/`
- Existing production project identification:
  - prior task history consistently points production at `vrdiqfudmwydclqpydee`

## External Resources

- None required beyond in-repo migration/task evidence and Supabase remote inspection.

## Constraints & Risks

- Supabase MCP in this workspace is linked to staging (`ndxmivcrehsacuerwxtm`), not production.
- Supabase migration-history endpoints are not available through the MCP session, so production verification must use a guarded direct DB path.
- This is a live production schema change; even though it is additive, it still needs rollback notes and evidence.
- Backup/PITR availability is assumed to be the standard Supabase-managed production posture and is not directly verifiable from this workspace.

## Findings

- Staging already contains `public.email_dispatch_intents` and `public.claim_due_email_dispatch_intents(...)`, verified via Supabase MCP.
- The current cutover task explicitly says the new migration has not yet been applied from this workspace.
- The migration is additive/idempotent:
  - creates a table if missing
  - adds guarded constraints/policies/indexes
  - creates/replaces a claim RPC
- The repo environment history identifies production as `vrdiqfudmwydclqpydee`.

## Open Questions (owner, due)

- None blocking from the workspace. Backup/PITR evidence remains an operational assumption.

## Recommended Direction (with rationale)

- Use a guarded direct Postgres connection from the local workspace to:
  - verify production target/ref and current object absence/presence
  - execute the migration in a single transaction
  - run post-apply schema checks
- Record dry-run/apply/check outputs in this task’s artifacts and update the cutover continuity notes once complete.

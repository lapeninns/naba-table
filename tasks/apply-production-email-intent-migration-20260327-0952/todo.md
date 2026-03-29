---
task: apply-production-email-intent-migration
timestamp_utc: 2026-03-27T09:52:10Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm staging already has `email_dispatch_intents` + claim RPC.
- [x] Create production rollout task artifacts.
- [x] Confirm production project ref before opening a write connection.

## Core

- [x] Run production preflight checks.
- [ ] Apply `20260327090000_add_email_dispatch_intents.sql` to production. Blocked: no valid production DB auth path or Supabase access token in this workspace.
- [ ] Run post-apply schema verification checks.

## Tests

- [ ] Save preflight output artifact.
- [ ] Save apply log artifact.
- [ ] Save post-apply verification artifact.

## Notes

- Assumptions:
  - Production Supabase project ref is `vrdiqfudmwydclqpydee`.
  - Supabase-managed PITR/backups are available for the production project.
- Deviations:
  - Supabase MCP in this workspace is staging-linked only, so production rollout uses a guarded direct SQL path.
  - Guarded direct SQL and `npx supabase@latest` CLI both failed authentication from this workspace, so no production DDL was attempted.

## Batched Questions

- None.

---
task: cron-email-fixes
timestamp_utc: 2026-01-26T09:52:43Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Cron email fixes

## Requirements

- Functional:
  - Reduce N+1 Redis `hgetall` calls in `GET /api/cron/process-emails`.
  - Preserve email processing correctness (no skipped/double sends).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Authenticated/guarded access for any trigger endpoint or script
  - Idempotent/deduped to avoid double-sending
  - Minimal blast radius (limit batches, dry-run option)
  - Reduce Redis round-trips per cron run; keep within Vercel cron timeouts

## Existing Patterns & Reuse

- Cron endpoint: `src/app/api/cron/process-emails/route.ts` (BullMQ queue fetch + per-job processing).
- Email queue: `server/queue/email.ts` (BullMQ `Queue`, job payloads, enqueue helper).
- Redis connection: `lib/queue/redis.ts` (ioredis client shared connection).
- Worker script: `scripts/queues/email-worker.ts` (similar email dispatch logic).
- Cron schedule: `vercel.json` → `/api/cron/process-emails`.

## External Resources

- None yet

## Constraints & Risks

- Follow AGENTS.md SDLC phases; no coding before requirements & plan reviewed
- Supabase remote-only for any migrations (if needed)
- BullMQ version in repo: `^5.65.1` (ensure API choices match this version)

## Open Questions (owner, due)

- Q: What success criteria and affected tenants should we validate against? (owner: github:@maintainers, due: 2026-01-26)
  A: TBD
- Q: Is there an existing QueueScheduler/worker running in production, or is cron the only processor? (owner: github:@maintainers, due: 2026-01-26)
  A: TBD

## Recommended Direction (with rationale)

- Optimize `/api/cron/process-emails` job fetching to avoid redundant Redis calls while keeping deterministic batching.

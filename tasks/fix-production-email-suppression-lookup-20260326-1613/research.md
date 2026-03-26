---
task: fix-production-email-suppression-lookup
timestamp_utc: 2026-03-26T16:13:39Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Fix Production Email Suppression Lookup

## Requirements

- Functional:
  - Restore production transactional email delivery for queued reminder and review emails.
  - Verify the live Resend + Cloudflare setup before changing DNS or sender configuration.
  - Send a real validation email to `amanshresthaaaaa@gmail.com` once the canonical delivery path is fixed.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not expose secrets in logs, commits, or artifacts.
  - Do not add bypasses that skip suppression checks entirely.
  - Keep the fix in the canonical sender/webhook path.

## Existing Patterns & Reuse

- Canonical sender path:
  - `libs/resend.ts`
  - `server/emails/bookings.ts`
- Queue and drain path:
  - `server/queue/email.ts`
  - `server/queue/email-processing.ts`
  - `src/app/api/cron/process-emails/route.ts`
- Resend bounce/complaint ingestion:
  - `src/app/api/webhook/resend/route.ts`

## External Resources

- Resend sending-domain verification docs via the repo audit script and live API.
- Cloudflare remains the authoritative DNS provider for `nabatable.com`.

## Constraints & Risks

- Production diagnosis must distinguish sender-domain problems from queue/runtime problems.
- Suppression logic must remain intact for bounced/complained recipients.
- Queue jobs already failed and may need retry or re-enqueue after the code fix.

## Findings

- Resend sending domain `notifications.nabatable.com` is verified.
- Authoritative nameservers are Cloudflare (`damien.ns.cloudflare.com`, `emerie.ns.cloudflare.com`).
- All required public Resend/SPF/DMARC/BIMI records currently match expected values.
- Vercel production env confirms `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL` and `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN` are present in the live project.
- Live queue status from `GET /api/admin/queue-status?includeJobs=1` shows failed jobs with:
  - `Failed to verify email suppression state: column user_profiles.email does not exist`
- Generated schema types confirm:
  - `profiles.email` exists
  - `user_profiles.is_email_suppressed` exists
  - `user_profiles.email` does not exist
- Current sender and webhook code both query `user_profiles.email`, so they are incompatible with the production schema.

## Open Questions (owner, due)

- Whether any additional queued jobs remain delayed and should be drained immediately after deploy.

## Recommended Direction (with rationale)

- Patch the suppression lookup to resolve recipient emails through `profiles.email`, then read/update suppression flags in `user_profiles` by profile id.
- Apply the same schema-safe lookup to the Resend webhook bounce/complaint handler so future suppressions continue to work.
- After deploy, retry failed jobs and send a real validation email to `amanshresthaaaaa@gmail.com`.

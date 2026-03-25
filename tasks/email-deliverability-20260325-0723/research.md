---
task: email-deliverability
timestamp_utc: 2026-03-25T07:23:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Research: Production email deliverability

## Requirements

- Functional:
- Stop production transactional emails from being sent through an effectively unauthenticated sender domain.
- Restore a working repository health check for Resend/domain status.
- Keep the Resend setup workflow aligned with the real authoritative DNS provider.

- Non-functional (a11y, perf, security, privacy, i18n):
- Security: do not expose secrets; rely on env-based credentials only.
- Reliability: use public DNS resolution, not only provider-side status, as the source of truth.
- Maintainability: avoid provider-specific automation that silently targets a non-authoritative zone.

## Existing Patterns & Reuse

- `libs/resend.ts` is the shared outbound email helper.
- `scripts/email/setup-notifications-domain.ts` already fetches the exact DNS records Resend expects.
- `package.json` exposes `pnpm email:check`, but the referenced script file is currently missing.
- Prior deliverability task artifacts exist in `tasks/resend-bimi-notifications-20260127-1220/`.

## External Resources

- Resend domain API data from the live account — provides the exact SPF/DKIM records the sender domain expects.
- Public DNS (`dig`) — confirms what receiving mailbox providers actually see.

## Constraints & Risks

- `nabatable.com` is delegated to Cloudflare nameservers, so changes made only in Vercel DNS do not affect live mail authentication.
- Resend still marks `notifications.nabatable.com` as `verified`, which can hide live public-DNS drift.
- Missing public SPF/DKIM/DMARC/BIMI for the active sender subdomain materially increases spam-folder risk.

## Open Questions (owner, due)

- Are Cloudflare DNS credentials available for immediate live repair? (owner: github:@amankumarshrestha, due: 2026-03-25)
- Do any non-app email paths still use a different sender domain via Supabase SMTP settings? (owner: github:@amankumarshrestha, due: 2026-03-25)

## Recommended Direction (with rationale)

- Patch the domain setup script so it detects the authoritative nameserver and refuses to "apply" records to Vercel when Vercel is not authoritative.
- Restore `pnpm email:check` with a public-DNS audit that compares Resend's expected records against live resolvers and warns when records only exist in Vercel DNS.
- Correct sender examples to `no-reply@notifications.nabatable.com`.
- Publish the missing Resend/SPF/DKIM/DMARC/BIMI records in Cloudflare DNS as the live remediation.

---
task: email-deliverability
timestamp_utc: 2026-03-25T07:23:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Production email deliverability

## Objective

We will align the repository's email tooling with the real authoritative DNS path so that transactional emails from `notifications.nabatable.com` can be authenticated correctly and future DNS drift is caught before it hurts inbox placement.

## Success Criteria

- [ ] `pnpm email:check` exists and fails loudly when public DNS is missing required Resend/SPF/DKIM records.
- [ ] `scripts/email/setup-notifications-domain.ts` detects authoritative DNS and no longer implies that Vercel DNS is live when the domain is delegated elsewhere.
- [ ] Sender examples point to `no-reply@notifications.nabatable.com`.
- [ ] Task artifacts record the exact production DNS mismatch and the records Cloudflare must publish.

## Architecture & Components

- `scripts/email/setup-notifications-domain.ts`: source of expected Resend records plus authoritative-DNS safety checks.
- `scripts/email/check-resend-status.ts`: public DNS audit for the sending domain and sender env alignment.
- Env/docs examples: keep sender address and operator guidance aligned with the verified sending domain.

## Data Flow & API Contracts

- Resend API:
  - `domains.list()` / `domains.get()` provide the canonical records Resend expects.
- Public DNS resolvers:
  - Query authoritative/public TXT and MX records for the live domain.
- Inputs:
  - `RESEND_API_KEY` required.
  - `RESEND_FROM` optional but audited when present.

## UI/UX States

- Not applicable. No UI change is planned.

## Edge Cases

- Resend reports the domain as `verified` even when public DNS no longer matches.
- Domains delegated to Cloudflare or another provider should not offer Vercel auto-apply.
- TXT values may be split across DNS strings; comparisons must normalize quoting and dots.

## Testing Strategy

- Run `pnpm exec dotenv -e .env.local -- tsx scripts/email/check-resend-status.ts`.
- Run `pnpm exec dotenv -e .env.local -- bash -lc 'BIMI_ASSET_BASE_URL=... pnpm -s email:setup:notifications-domain'`.
- Re-run targeted `dig` commands against public and Vercel nameservers.

## Rollout

- No feature flag.
- Repo changes ship immediately after merge.
- Live fix requires manual publication of the same records in Cloudflare DNS.
- Monitoring: rerun `pnpm email:check` after DNS propagation and verify public resolvers return the expected records.

## DB Change Plan (if applicable)

- Not applicable.

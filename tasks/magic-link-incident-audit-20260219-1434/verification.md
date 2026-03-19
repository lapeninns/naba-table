---
task: magic-link-incident-audit
timestamp_utc: 2026-02-19T14:34:32Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable: no UI code changes were made.

## Test Outcomes

- `node --input-type=module` audit script (Resend + Supabase service-role correlation) succeeded.
- `vercel logsv2 --environment production --since 7d --query "/api/auth/signin" --json --limit 1000` succeeded.
- JSON summarization scripts succeeded for both datasets.

## Artifacts

- Magic-link production audit:
  - `artifacts/magic-link-production-audit.json`
- Vercel raw logs:
  - `artifacts/vercel-logsv2-auth-signin-7d.jsonl`
- Vercel parsed summary:
  - `artifacts/vercel-logsv2-auth-signin-7d-summary.json`

## Key Evidence Extract

- Magic-link sends (Resend):
  - 24h: 5 sends, 5 unique recipients.
  - 7d: 30 sends, 27 unique recipients.
  - 7d recipients with no bookings: 25/27 (92.59%).
- Auth endpoint logs (`/api/auth/signin` window available in Vercel logs):
  - 25 total requests, statuses: 12x401, 5x202, 5x500, 3x200.
  - All 500s include: `Unexpected verification type from Supabase generateLink: signup`.

## Known Issues

- Auth-user enrichment through `auth.admin.listUsers` had pagination failure (`Database error finding users`), so auth-user counts in the audit are conservative/partial.

## Sign-off

- [x] Engineering investigation complete.
- [ ] Product decision on mitigations pending.

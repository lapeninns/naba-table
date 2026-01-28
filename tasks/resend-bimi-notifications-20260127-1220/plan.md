---
task: resend-bimi-notifications
timestamp_utc: 2026-01-27T12:20:26Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Resend + Vercel DNS + DMARC + BIMI

## Objective

We will configure `notifications.nabatable.com` as a fully authenticated sending domain via Resend, with DMARC enforcement and BIMI to show a single brand logo where supported.

## Success Criteria

- [ ] Resend domain verifies for `notifications.nabatable.com`.
- [ ] SPF, DKIM, and DMARC pass with alignment for emails sent from `notifications.nabatable.com`.
- [ ] BIMI TXT record publishes for `default._bimi.notifications.nabatable.com`.
- [ ] BIMI-ready Tiny-PS SVG is produced from the existing logo.

## Architecture & Components

- Resend Domain Identity: canonical source for required SPF/DKIM records.
- Vercel DNS: authoritative DNS for publishing TXT/CNAME records.
- DMARC: root and subdomain enforcement with reporting.
- BIMI: subdomain BIMI TXT referencing HTTPS assets.

## Data Flow & API Contracts

1. Resend API: create domain → fetch DNS records → verify domain.
2. Vercel DNS: publish Resend-provided SPF/DKIM + DMARC + BIMI records.
3. DNS propagation → Resend verification → test mail.

## UI/UX States

- N/A (infra configuration + asset conversion).

## Edge Cases

- DMARC enforcement without SPF/DKIM alignment can block mail.
- BIMI may not display without VMC/CMC (notably Gmail).
- Some providers cache BIMI/DMARC results; propagation can take hours.

## Testing Strategy

- DNS checks with `dig`/`nslookup`.
- Send test email and inspect Authentication-Results.
- Optional: third-party tools (e.g., Gmail header inspection, mail-tester).

## Rollout

- DMARC set to quarantine at 100% initially.
- After observing aligned passes, optionally increase to reject.

## DB Change Plan (if applicable)

- Not applicable.

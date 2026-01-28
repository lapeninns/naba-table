---
task: resend-bimi-notifications
timestamp_utc: 2026-01-27T12:20:26Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task artifacts folder and SDLC documents.
- [x] Add CLI automation script: `scripts/email/setup-notifications-domain.ts`
- [x] Create/lookup Resend domain identity for `notifications.nabatable.com`.
- [x] Fetch Resend DNS records and map to Vercel DNS (via CLI dry run).

## Core

- [x] Publish DMARC enforcement for root and subdomain (Vercel DNS).
- [x] Publish BIMI TXT record for subdomain (Vercel DNS).
- [x] Convert animated SVG to BIMI Tiny-PS static SVG (`public/brand/nabatable-bimi.svg`).
- [x] Host BIMI SVG at `assets.nabatable.com/bimi/nabatable-bimi.svg` via Vercel.

## Tests

- [x] Run DNS checks with `dig`.
- [x] Verify domain in Resend (verification request accepted).
- [x] Confirm BIMI asset URL returns HTTP 200.
- [ ] Send test email and inspect headers.

## Notes

- Assumptions: Resend DNS records will be retrieved via API once credentials are provided.
- Deviations: DNS application is gated behind `APPLY_DNS=1` and `VERCEL_TOKEN` for non-interactive safety.

## Batched Questions

- Provide RESEND_API_KEY, VERCEL token/scope, asset base URL, and PEM URL when ready.

---
task: email-deliverability
timestamp_utc: 2026-03-25T07:23:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and gather current deliverability evidence.
- [x] Identify the active sender domain and authoritative nameservers.

## Core

- [x] Patch `scripts/email/setup-notifications-domain.ts` to respect authoritative DNS.
- [x] Add `scripts/email/check-resend-status.ts`.
- [x] Correct sender examples and operator docs.

## UI/UX

- [ ] Not applicable.

## Tests

- [x] Run the new deliverability audit script.
- [x] Re-run the setup dry run and confirm the new authoritative-DNS warning path.
- [x] Capture public DNS verification output.

## Notes

- Assumptions:
- Cloudflare is the live authoritative DNS provider for `nabatable.com`.

- Deviations:
- Live DNS was applied directly in Cloudflare once a DNS-edit token was provided.

## Batched Questions

- Rotate the Cloudflare API token used for this change because it was shared directly in chat.

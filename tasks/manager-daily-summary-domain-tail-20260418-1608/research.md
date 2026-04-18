---
task: manager-daily-summary-domain-tail
timestamp_utc: 2026-04-18T16:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: Manager Daily Summary Domain Tail

## Requirements

- Append `app.nabatable.com` to the current canonical manager daily summary SMS template.
- Keep the change in the shared formatter so every manager-summary send path stays aligned.

## Existing Patterns & Reuse

- Canonical manager daily summary copy is built in `lib/ops/daily-booking-summary.ts`.
- The Cloudflare SMS summary gateway consumes that same formatter via `cloudflare/sms-summary-gateway/src/supabase.ts`.
- Focused formatter assertions already exist in `tests/utils/dashboardSummary.test.ts` and downstream worker expectations exist in `tests/cloudflare/sms-summary-gateway.test.ts`.

## Constraints & Risks

- The change affects outbound SMS copy, so expectations must be updated anywhere the exact body is asserted.
- This is a non-UI text change, so browser verification is not required; automated proof is sufficient.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Update the shared formatter in `lib/ops/daily-booking-summary.ts` to append the domain as the final sentence.
- Update focused test expectations to prove the canonical message shape remains consistent across direct formatter and worker usage.

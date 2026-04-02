---
task: fix-email-template-review-findings
timestamp_utc: 2026-04-02T14:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Notes

- Not required for this follow-up because the fix is limited to server behavior and tests; no UI surface changed.

## Test Outcomes

- [x] Targeted Vitest suite
- [x] Typecheck

## Artifacts

- Vitest summary: `artifacts/vitest-summary.txt`
- Typecheck: `artifacts/typecheck.txt`

## Known Issues

- [ ] None currently recorded.

## Summary

- `server/emails/bookings.ts` now uses nonce-backed idempotency keys for manual template test sends only.
- `server/emails/bookings.ts` now uses the resolved CTA label and URL in the plain-text email body.
- `server/restaurants/emailTemplates.ts` now retries against the latest `updated_at` snapshot and merges only the targeted template key to avoid clobbering unrelated concurrent edits.
- Added regression coverage in `tests/server/restaurant-email-templates.test.ts`.

## Sign-off

- [x] Engineering

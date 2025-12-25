---
task: session-recovery-token-crud
timestamp_utc: 2025-12-25T12:46:33Z
owner: github:@maintainers
reviewers: [github:@web-core]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Automated Tests

- [x] `pnpm exec vitest run 'src/app/api/bookings/[id]/route.test.ts' 'src/app/api/bookings/route.test.ts' 'tests/server/bookings/pastTimeValidation.test.ts'`

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

- [x] Opened `/bookings/recover?access_token=test&next=/` with `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` unset → error page renders expected copy and actions.
- [x] Opened legacy link format `/bookings/<id>?token=<redacted>` and confirmed API returns `TOKEN_NOT_FOUND` (environment/token mismatch); UI surfaces an error state without exposing token values.
- [ ] End-to-end happy path (email manage link → recover → booking detail → edit/cancel) requires `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` configured for the running environment.
- [ ] A11y smoke: keyboard navigation through edit/cancel dialogs (pending end-to-end setup).

## Artifacts

- Screenshots:
  - `artifacts/recover-error-access-token-not-configured.png`
  - `artifacts/booking-detail-legacy-token-not-found.png`

---
task: operating-hours-advisory-notes
timestamp_utc: 2026-04-17T16:44:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Verification surface: dev harness at `http://localhost:3001/dev/guest-booking-plan-alert`

Why this surface:

- The changed behavior lives in the plan-step advisory derivation.
- The repo already had a dev-only harness for this alert, and it was extended to include an operating-hours-note scenario so the browser proof could cover the exact UI state without needing seeded backend note data.

### Console & Network

- [x] No console errors observed. Console output was limited to development/info logging from HMR and analytics tooling.
- [x] Network requests completed successfully for the dev harness route. No failed requests were observed in the captured request list.

### DOM & Accessibility

- [x] The note scenario rendered an alert containing `Kitchen closes early at 8:30 PM due to a private event.`
- [x] Weekend and override fallback alerts still rendered the original advisory copy.
- [x] Chrome DevTools snapshot showed the alert nodes rendered with live-region semantics.

### Performance

- Local trace surface: `http://localhost:3001/dev/guest-booking-plan-alert`
- Trace environment: local `next dev`, no CPU throttling, no network throttling
- Observed metrics from Chrome DevTools trace:
  - LCP: `153 ms`
  - CLS: `0.00`
- Lighthouse snapshot (mobile):
  - Accessibility: `100`
  - Best Practices: `100`
  - SEO: `100`
- Notes:
  - This local dev-harness trace is compensating evidence only, not a production-budget sign-off under the repo's preferred throttled mobile conditions.
  - The available Lighthouse MCP run for this surface does not include performance/TBT output.

## Test Outcomes

- [x] `pnpm vitest run tests/reserve/plan-step-advisory.test.ts tests/reserve/reservation-schedule-normalization.test.ts tests/a11y/planStepForm.a11y.test.tsx`
- [x] Result: 3 test files passed, 8 tests passed.
- [x] Known pre-existing stderr during the a11y test remained non-fatal:
  - JSDOM canvas `getContext()` not implemented
  - React `act(...)` warnings from the existing PlanStepForm test setup

## Artifacts

- Screenshot: `artifacts/guest-booking-plan-alert.png`
- Lighthouse: `artifacts/lighthouse-mobile/report.json`
- Lighthouse HTML: `artifacts/lighthouse-mobile/report.html`
- Performance trace: `artifacts/guest-booking-plan-alert-trace.json`

## Known Issues

- None currently.

## Sign-off

- [x] Engineering
- [x] QA

---
task: guest-functionality-audit
timestamp_utc: 2025-12-11T18:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and capture requirements/plan.
- [x] Reconcile guest route inventory with current app structure (`guest-facing-routes.md` vs `src/app`).

## Core Audit

- [x] Inspect guest dashboard + booking detail components to verify real functionality (QR dialog, stats, actions).
- [x] Inspect guest profile component to confirm persistence gaps.
- [x] Review hooks/services for QR payload or profile mutations; note if missing.
- [x] Run targeted automated tests (unit/e2e) for guest flows if feasible; record results.

## Remediation

- [x] Remove QR dialog/panel UI from guest dashboard and booking detail to avoid non-functional placeholders.
- [x] Wire `GuestProfileClient` to the `/api/profile` mutation (via `useUpdateProfile`), reset defaults from query data, and drop the inert toggles/delete CTA.

## Reporting

- [ ] Summarize each guest-facing flow with status (functional vs placeholder) in final response + `verification.md`.
- [ ] Enumerate remediation recommendations for non-functional features (should now only note removed functionality).

## Notes

- Assumptions: Access to Supabase/Playwright env may be limited; rely on code inspection if services unavailable.
- Deviations: None yet.

---
task: fix-ci-checks
timestamp_utc: 2026-01-30T14:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: CI Checks Stabilization

## Objective

We will update CI workflows so required checks pass reliably in PRs without secrets while preserving security/a11y/perf coverage when prerequisites exist.

## Success Criteria

- [ ] ZAP Baseline completes or skips safely when it cannot create issues.
- [ ] Security scan uses a valid trufflehog tag.
- [ ] DB drift check skips when `DRIFT_CHECK_DB_URL` is missing.
- [ ] Lighthouse uses an available CLI (or installs it) and completes.
- [ ] Accessibility job skips when no tests exist.
- [ ] Preview deploy job skips when Vercel secrets are missing.
- [ ] Vercel preview build succeeds without missing middleware NFT artifacts.
- [ ] Ops print view CSS builds under Webpack and preserves print-only visibility.
- [ ] Guest booking page wrapper passes valid page props to satisfy Next.js build.

## Architecture & Components

- `.github/workflows/ci.yml`: update security, db drift, lighthouse, accessibility, and preview deploy jobs.
- `.github/workflows/dast.yml`: adjust ZAP permissions or disable issue creation.
- `package.json`: force Webpack for production build.
- `src/components/features/dashboard/OpsBookingsPrintView.module.css`: fix print selector purity.
- `src/components/features/dashboard/OpsBookingsPrintView.tsx`: add/remove body class for print view.
- `src/app/guest/bookings/[bookingId]/page.tsx`: fix wrapper props typing.

## Data Flow & API Contracts

- Not applicable (workflow-only changes).

## UI/UX States

- Not applicable.

## Edge Cases

- Forked PRs without secrets should not fail.
- Missing test directories should not be treated as failures.
- Turbopack build output may not include middleware NFT artifacts required by Vercel.
- CSS Modules pure selectors require local class or id per selector.

## Testing Strategy

- Manual UI QA via Chrome DevTools MCP (print view) due to UI/CSS changes.

## Rollout

- PR-based rollout; monitor GitHub Actions results after push.

## DB Change Plan (if applicable)

- Not applicable.

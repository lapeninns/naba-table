---
task: guest-ui-testing
timestamp_utc: 2025-11-25T12:46:06Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan

## Objective

Execute a comprehensive suite of Chrome DevTools (MCP) tests covering all guest‑facing routes, validating functional UI flows, accessibility, performance, SEO, responsiveness, and custom business logic.

## Success Criteria (re‑stated)

- Lighthouse scores: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90.
- Zero critical a11y violations.
- All navigation links work without errors.
- All forms (sign‑in, booking, profile) submit successfully with valid test data.
- No unexpected console errors.
- Mobile viewport renders correctly.
- All required artifacts are captured.

## Test Matrix

| Route                             | Test Types                                   | Key Interactions                                                |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `/`                               | Functional, A11y, Perf, SEO, Resp            | Verify hero, navigation links, CTA button.                      |
| `/restaurants/[slug]`             | Functional, A11y, Perf, SEO, Resp            | Load profile, verify image, description, rating, “Book” button. |
| `/restaurants/[slug]/book`        | Functional, A11y, Perf, Resp, Business Logic | Fill date picker, party size, contact form, submit booking.     |
| `/bookings/[bookingId]/thank-you` | Functional, A11y, Perf, SEO, Resp            | Verify confirmation details, “Back to Home” link.               |
| `/auth/signin`                    | Functional, A11y, Perf, SEO, Resp            | Enter valid credentials, submit, ensure redirect.               |
| `/guest/dashboard`                | Auth‑only, Functional, A11y, Perf, Resp      | Verify greeting, quick‑links, recent bookings.                  |
| `/guest/bookings`                 | Auth‑only, Functional, A11y, Perf, Resp      | List view, pagination, filter tabs (upcoming/past).             |
| `/guest/bookings/[bookingId]`     | Auth‑only, Functional, A11y, Perf, Resp      | Detail view, edit/cancel buttons, status badge.                 |
| `/guest/profile`                  | Auth‑only, Functional, A11y, Perf, Resp      | Edit avatar, name, email, save changes.                         |

## Data Setup

- **User Credentials**: `amanshresthaaaaa@gmail.com` / `amanshresthaaaaa@gmail.com`
- **Dynamic Discovery**:
  - **Restaurant Slug**: Navigate to the home/listing page and extract a valid restaurant slug dynamically (instead of hardcoding `test-restaurant`).
  - **Booking ID**: Navigate to `/guest/bookings` after login and extract a valid booking ID (instead of hardcoding `test-booking-123`).

## Feature‑Flag Audit

- Search the codebase for `process.env.NEXT_PUBLIC_` flags related to guest UI.
- Ensure they are set to `true` in `.env.local` before testing.

## Artifact Collection Strategy

- **Screenshots**: Desktop (1920×1080) and Mobile (Pixel 7 412×892) after each page load.
- **Lighthouse JSON**: Run `chrome-devtools://devtools/inspector.html?remoteFrontend=true&...` via MCP to generate JSON.
- **HAR logs**: Capture network traffic for each navigation.
- **Console logs**: Record any console warnings/errors.
- **Accessibility audit**: Export the a11y report from Chrome DevTools.
- **Videos**: Record a short video for any failed step (auto‑captured by MCP).

## Workflow Overview

1. Launch Chrome via the browser sub‑agent.
2. **Login First**: Log in with `amanshresthaaaaa@gmail.com` to ensure authenticated routes are accessible.
3. **Dynamic Discovery**:
   - Go to `/guest/bookings` -> Pick first booking ID.
   - Go to `/` -> Pick first restaurant slug.
4. **Execute Test Matrix**: Iterate through all routes (using discovered IDs/slugs).
   - Set viewport (Desktop then Mobile).
   - Navigate, Capture Artifacts (Screenshot, Lighthouse, HAR, Console, A11y).
   - Perform functional interactions (Forms, Buttons).
5. Store all artifacts under `tasks/guest-ui-testing-<timestamp>/artifacts/`.
6. Generate a summary `verification.md` linking to the artifact files.

## Rollout

- Run the workflow locally on the developer machine.
- Review the generated reports.
- If any failures, iterate on the UI until all success criteria are met.

## Risks & Mitigations

- **Flaky network**: Retries on navigation failures.
- **Supabase latency**: Add explicit wait for API responses before assertions.
- **Feature‑flag mismatch**: Verify env before run; fail fast if missing.

## Acceptance

- All artifact files present.
- Scores meet thresholds.
- No critical a11y violations.
- All form submissions succeed.
- Reviewer signs off the task folder.

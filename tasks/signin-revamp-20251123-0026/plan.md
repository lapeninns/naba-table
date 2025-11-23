---
task: signin-revamp
timestamp_utc: 2025-11-23T00:26:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Sign-in Revamp

## Objective

We will enable users to sign in with improved UI/UX and navigation so that access flows feel modern, responsive, and accessible.

## Success Criteria

- [ ] Navbar present on sign-in page with consistent design and accessible links.
- [ ] Sign-in page updated with refreshed layout/copy that remains usable on mobile first.
- [ ] Sign-in form responsive, keyboard accessible, and passes basic Axe checks (0 serious/critical issues) in manual QA.

## Architecture & Components

- `src/app/auth/signin/page.tsx`: add `CustomerNavbar` to top of page; refresh hero layout, spacing, and background; keep skip link.
- `components/auth/SignInForm.tsx`: tighten spacing, mobile-first widths, improve tab/button layout; keep logic intact.
- Shared UI components: reuse existing Shadcn UI elements and utilities (`Button`, `Input`, `Card`, etc.).

## Data Flow & API Contracts

- Supabase auth calls remain unchanged (`signInWithOtp` / `signInWithPassword`); no new APIs.
- Redirect handling continues via `redirectedFrom` query param.

## UI/UX States

- Loading: submit button shows spinner.
- Success: status message shown; redirect triggered on password success.
- Error: inline status message and field errors.
- Empty: initial state shows method toggle and empty inputs.
- Navbar: mobile menu + desktop primary nav remain usable; ensure focus visible.

## Edge Cases

- Redirect param missing or invalid → fall back to `/guest/bookings`.
- Magic link cooldown messaging on mobile (ensure layout does not break).
- Keyboard navigation through navbar, skip link, form tabs/buttons.

## Testing Strategy

- Manual QA via Chrome DevTools MCP: mobile (375px), tablet, desktop; check console/network; run Axe if available.
- Spot-check form validation for email required, password required in password mode, magic link cooldown state.
- Visual/responsive check on small screens.

## Rollout

- No feature flag. Release behind standard deployment.
- Monitoring: existing analytics events for auth flows.
- Kill-switch: revert page layout change if necessary.

## DB Change Plan (if applicable)

- Not applicable (no DB schema changes).

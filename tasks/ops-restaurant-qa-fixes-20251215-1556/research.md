---
task: ops-restaurant-qa-fixes
timestamp_utc: 2025-12-15T15:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Restaurant QA Fixes

## Scope

- **In scope**: Restaurant-facing (Ops) routes and shared infra that directly affects them (middleware routing/headers, ops shell, ops list views, ops seating floor plan).
- **Out of scope**: Guest-facing flows, marketing pages, and unrelated refactors.

## Source QA Report

- Primary findings + metrics: `tasks/devtools-restaurant-qa-20251215-1156/verification.md`

## Requirements (from QA)

- **P1**: Offline mode must not allow navigation/pagination that hard-navigates to browser offline error pages.
- **P1**: Add baseline security headers (CSP, Referrer-Policy, X-Content-Type-Options, etc.).
- **P1**: `/seating/floor-plan` must not have extreme render-delay/LCP under constrained devices (Fast 3G + 4× CPU).
- **P2**: Reduce or explain high/variable TTFB (especially `/customers`).
- **P2**: Address Supabase console warning about untrusted session user objects (`getSession()` / `onAuthStateChange()` guidance).
- **P3**: Fix Chrome “form field missing id/name” issue (autofill + minor semantics).

## Existing Patterns & Reuse

- Offline indicator + toast guard exists in ops sidebar navigation: `src/components/features/ops-shell/OpsSidebarLayout.tsx`.
- Ops pagination is centralized: `components/dashboard/Pagination.tsx` used by Ops bookings/customers.
- Ops floor plan route is a dedicated client page: `src/app/app/(app)/seating/floor-plan/page.tsx`.
- Customer page previously did server-side prefetch/hydration that can inflate TTFB: `src/app/app/(app)/customers/page.tsx` (pre-fix).

## Constraints & Risks

- **Supabase is remote-only** (per project policy). No local migrations/seeding.
- Authenticated Ops routes require a working staff account; local “test endpoint” provisioning may be unavailable if Supabase Auth admin APIs error.
- Node engine mismatch warning (repo wants Node 20.11.1; environment uses Node 22.12.0) may affect `next dev` stability.

## Open Questions (owner, due)

- Ops staff credentials for local QA (Owner: github:@amankumarshrestha, Due: ASAP).
- Supabase Auth admin endpoint health (`auth.admin.listUsers()` returning 500 “Database error finding users”) blocks test-session provisioning (Owner: github:@amankumarshrestha, Due: ASAP).

## Recommended Direction (with rationale)

- Fix offline navigations at the **ops shell boundary** (click-capture guard) + guard list pagination callbacks to prevent URL navigations while offline.
- Add security headers in middleware for consistent app-host + root-host coverage.
- Optimize floor plan by reducing O(n²) timeline lookups and progressively rendering “decorative” elements after first paint.
- Remove redundant server-side work on `/customers` by shifting to client data fetch (consistent with `/bookings`/`/dashboard`).

# Guest booking journey design consistency

## Plan Overview

Unify the guest booking journey into one mobile-first frontend design system, using the existing bookings pages as the visual source of truth. Scope is limited to guest-facing booking journey routes and destination experiences; no backend changes, no new product behavior, and no copy rewrites unless a tiny UX wording adjustment becomes unavoidable.

Captured requirements:

- Frontend only
- Focus on the booking journey
- Cover `/bookings`, `/restaurants/[slug]/book`, `/restaurants/[slug]/book/thank-you`, `/restaurants/[slug]/thank-you`, `/bookings/[bookingId]`, `/bookings/[bookingId]/manage`, `/bookings/[bookingId]/thank-you`, `/bookings/recover/error`
- Existing bookings pages are the visual source of truth
- Preserve current behavior/copy
- Optimize especially for fast one-hand booking on mobile
- Keep 3 milestones
- Treat legacy alias routes as redirect QA checkpoints only

## Expected Functionality

### Milestone 1 — Shell and design-token alignment

- Align restaurant booking flow shell with the bookings-system visual language
- Align thank-you, receipt-adjacent, and recovery surfaces to the same typography, spacing, radius, card, CTA, and page-shell patterns
- Normalize context-aware navigation/back affordances where public vs guest routes currently feel inconsistent

### Milestone 2 — Mobile-first booking interaction improvements

- Reduce mobile scroll/friction in the booking flow where possible without changing behavior
- Make primary guest actions easier to reach on mobile detail/receipt-related surfaces
- Improve responsive action rows, tap targets, and hierarchy for narrow viewports

### Milestone 3 — Confirmation/recovery consistency and responsive QA

- Make confirmation, thank-you, detail, and recovery states feel like one system
- Keep redirect routes unchanged functionally, but verify their destinations inherit the unified UX language
- Complete route-by-route responsive QA for the booking journey

## Environment Setup

- Reuse the existing local app server on port `3000`
- Environment validation already works with the current local setup (`pnpm validate:env` passed)
- No new external credentials are required for this frontend-only mission beyond the repo’s existing local environment

## Infrastructure

**Services / processes**

- Existing Next.js dev server on `http://127.0.0.1:3000`
- No new backend/service processes planned for this mission

**Boundaries**

- Frontend-only changes
- Reuse the running port `3000` server for validation
- Do not alter redirect semantics for legacy alias routes
- Do not introduce backend/API/data-model changes
- Avoid isolated Playwright webServer startup while the existing dev server owns `.next/dev/lock`

## Testing Strategy

- Worker-level validation should focus on changed frontend units/components plus route-level integration where existing tests already cover the journey
- Run repo validators relevant to touched frontend code (`typecheck`, applicable lint/tests)
- Add or adjust frontend tests only where they directly protect the changed journey behaviors/layout logic

## User Testing Strategy

- Primary validation surface: browser-based guest flow checks against the shared server on port `3000`
- Priority routes:
  - `/bookings`
  - `/restaurants/[slug]/book`
  - `/restaurants/[slug]/book/thank-you`
  - `/bookings/[bookingId]`
  - `/bookings/recover/error`
- Mobile-first validation should use mobile viewport checks first, then tablet/desktop responsive passes
- Redirect-only aliases are validated as entrypoint correctness + destination UX consistency, not redesigned directly

## Validation Readiness

Dry run status: executable.

- `pnpm validate:env` succeeded
- Existing app server on `3000` served booking pages successfully
- Browser automation is feasible in this environment
- Default isolated Playwright startup is currently blocked by `.next/dev/lock`, so this mission should validate against the shared running server instead
- Machine capacity is strong (18 logical CPU, 64 GiB RAM); browser validation concurrency is not the bottleneck, but shared-server validation should still stay conservative and deterministic

## Non-Functional Requirements

- Maintain responsive behavior across mobile, tablet, and desktop
- Prioritize fast, one-hand mobile booking interactions
- Preserve existing route behavior and booking flow semantics
- Keep visual consistency high across all canonical booking journey destinations
- Minimize regression risk on guest self-service and redirect entrypoints

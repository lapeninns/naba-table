---
task: restaurant-onboarding-wizard
timestamp_utc: 2025-12-02T07:46:28Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: [feat.onboarding-wizard]
related_tickets: []
---

# Implementation Plan: Restaurant Sign-up & Onboarding Wizard

## Objective

Enable new restaurant owners to self-serve account creation and complete a guided 6-step onboarding (profile → hours → service periods → zones & tables → review) so they exit with an active restaurant ready for bookings.

## Success Criteria

- [ ] `/auth/signup` renders a functional signup form (password or magic link) with CSRF/rate limit; successful signup redirects into onboarding.
- [ ] New onboarding pages `/onboarding`, `/onboarding/profile|hours|services|tables|review` load, persist data to Supabase, and allow resume with existing state.
- [ ] Server APIs (`/api/auth/signup`, `/api/onboarding/...`) validate inputs (zod), reuse domain services, and return useful errors; auth/CSRF enforced.
- [ ] At least one zone+table, weekly hours, and service period saved; restaurant ends marked active/complete; data visible via existing ops services.
- [ ] A11y/perf budgets met on new pages; keyboard flows and aria-live status verified.

## Architecture & Components

- **Route group:** `src/app/(onboarding)` with shared layout (hero + wizard shell) and client provider.
- **Wizard state:** reducer/context modeled after `reserve/features/reservations/wizard` but with 6 steps; stores restaurantId, profile, hours, servicePeriods, zones, tables, loading/error. Persist latest server payloads.
- **UI building blocks:**
  - `OnboardingWizard` container using adapted `WizardContainer/Step/Progress/Navigation` for 6 steps.
  - Forms:
    - Signup form (react-hook-form + zod) based on `GuestSignInForm` styling.
    - Profile step reuses/adapts `RestaurantDetailsForm` fields (name, slug, timezone, contacts, booking policy, interval/duration/buffer, email toggles).
    - Hours step: simplified weekly grid (open/close, closed toggle) inspired by `OperatingHoursSection` but without overrides.
    - Service periods step: simplified builder using `ServicePeriodsSection` logic for overlaps, default Lunch/Dinner/Drinks options from occasions catalog.
    - Tables step: mini zone & table creator (name, type, sort, active; table number, capacity, min/max party, category, seating, mobility, status). Optionally expose allowed capacities defaults (2,4,6,8) if time permits.
    - Review step: summary cards (profile/hours/service periods/zones+tables) with edit links.
- **Providers:** Use existing `AppProviders` (QueryClient). Add `OnboardingProvider` client component to wrap steps; keep compatible with public layout (no ops providers required until activation).
- **Feature flag:** gate new signup + onboarding behind `feat.onboarding-wizard` config/flag to allow rollback; fallback to existing placeholder if disabled.

## Data Flow & API Contracts

- **POST `/api/auth/signup`**
  - Body: `{ mode: 'password'|'magic_link', email: string, password?: string, redirectedFrom?: string }` (zod + password policy when mode=password).
  - Behavior: validate CSRF, rate-limit (reuse signin pattern), sign up via Supabase (`signUp` or `signInWithOtp({ shouldCreateUser:true })`); respond `{ status: 'ok'|'magic_link_sent', redirectTo: '/onboarding/profile' }`.
- **POST `/api/onboarding/restaurant`**
  - Body: profile payload (name, slug?, timezone, capacity?, contacts, address, map url, booking_policy, email flags, reservation intervals/durations/buffer).
  - Auth: requires authenticated user; creates restaurant + owner membership using `server/restaurants/create`; returns `{ restaurant }` (DTO aligned with ops API) and `restaurantId` for wizard.
- **PATCH `/api/onboarding/restaurant/[id]/hours`**
  - Body: `{ weekly: [{ dayOfWeek, opensAt?, closesAt?, isClosed?, notes? }] }`.
  - Uses `updateOperatingHours` with sanitized weekly entries, default empty overrides.
- **PATCH `/api/onboarding/restaurant/[id]/service-periods`**
  - Body: array of `{ id?, name, dayOfWeek|null, startTime, endTime, bookingOption }`; normalize bookingOption to catalog key; use `updateServicePeriods`.
- **POST `/api/onboarding/restaurant/[id]/zones`**
  - Body: `{ zones: [{ id?, name, areaType, sortOrder?, active? }] }`; upsert via zone service (batch insert + deactivate missing?).
- **POST `/api/onboarding/restaurant/[id]/tables`**
  - Body: `{ tables: [{ id?, tableNumber, capacity, minPartySize, maxPartySize?, zoneId, category, seatingType, mobility, status, active?, notes?, position? }] }`; validate min/max vs capacity; create in bulk with upsert semantics; optionally seed allowed_capacities (2,4,6,8) if empty.
- **POST `/api/onboarding/restaurant/[id]/complete`**
  - Body: optional `{ allowedCapacities?: number[] }`; marks onboarding complete (heuristic: set `is_active=true`, maybe flag in metadata), returns `{ status:'complete' }`.
- **Resume heuristic:** On `/onboarding` server component, fetch restaurant (latest created for user) and check for hours/service periods/zone+table presence to pick step; fallback step=2 if missing profile.

## UI/UX States

- Loading skeletons per step; disable nav buttons while saving.
- Error surfaces inline per field + top-level alert; aria-live for submission status.
- Navigation: Back/Next, Save & Continue; prevent skipping required data (e.g., at least one service period, at least one active table+zone).
- Responsive layout (mobile-first); avoid sticky footers causing overlap; preserve scroll/focus on validation errors.

## Edge Cases

- Slug collision: show error from API; allow user to adjust slug.
- Time validation: open < close; service periods cannot overlap on same day unless option is overlap-exempt (`drinks`).
- Closed days: allow isClosed with no times; ensure weekly rows default to closed to avoid missing data.
- Table validation: minPartySize ≤ capacity and ≤ maxPartySize (if provided); unique table_number per restaurant.
- Auth states: if session expires mid-onboarding, redirect to signin with return path.
- Magic link signups: handle pending verification—show banner to check email; allow re-send.
- Resume/refresh: state rehydration from server; guard against missing restaurantId.

## Testing Strategy

- Unit: wizard reducer/state machine; slug generator; validation helpers for hours/service periods/tables.
- API route tests (vitest/request): happy path + validation failures for each onboarding endpoint; auth + CSRF checks.
- Integration: minimal Playwright flow covering signup→profile→hours→service periods→tables→review submit (behind flag).
- A11y: axe on signup + one onboarding page; keyboard traversal manual checks; focus trapping in dialogs (if any).
- Perf: Lighthouse sample on `/auth/signup` and `/onboarding/profile` mobile emulation; ensure CLS/JS budgets.

## Rollout

- Feature flag `feat.onboarding-wizard` read from config/env; if off, keep old invite-only page.
- Soft-launch: enable for small org, monitor errors/logs; add console/log breadcrumbs for API failures.
- Kill switch: flag off reverts UI to placeholder; APIs remain but can be gated by flag check.

## DB Change Plan (if applicable)

- No new migrations planned. Using existing tables (`restaurants`, `restaurant_operating_hours`, `restaurant_service_periods`, `zones`, `table_inventory`, `allowed_capacities`). If onboarding progress flag becomes required, will need new migration with backup/rollback plan (future decision).

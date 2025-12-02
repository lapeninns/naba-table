---
task: restaurant-onboarding
timestamp_utc: 2025-12-02T02:30:00Z
owner: github:@assistant
---

# Research Notes

## Existing Wizard Pattern

- Booking wizard located under `reserve/features/reservations/wizard/` with reducer-driven state, context provider, and shared UI (`WizardStep`, `WizardNavigation`, `WizardProgress`, `WizardLayout`).
- `WizardContext` exposes `state`, `actions`, and navigation helpers with four steps hardcoded; new onboarding flow will need its own provider/step count.
- State reducer and initializers defined in `reserve/features/reservations/wizard/model/reducer.ts` and store utilities in nearby files.

## Auth/CSRF Patterns

- Sign-in route (`src/app/api/auth/signin/route.ts`) uses zod validation, CSRF (`validateCsrfToken`), rate limiting, and Supabase auth clients with JSON responses.
- Callback handling exists at `src/app/api/auth/callback/route.ts` (not yet inspected) for redirect flows.

## Restaurant Settings Components

- `components/ops/restaurants/RestaurantDetailsForm.tsx` implements client-side validation and mapping for restaurant profile fields (name, slug, timezone, contact/contact policy preferences) using custom state rather than react-hook-form.
- Settings sections under `src/components/features/restaurant-settings/` provide UI/logic for Operating Hours, Service Periods, etc., using hooks like `useOpsOperatingHours`/`useOpsUpdateOperatingHours` and types from `types.ts`. These can inform onboarding form structure and validation rules.

## Routing & Layout

- Auth pages live under `src/app/auth/*` (currently only sign-in). Main app uses Next.js App Router with global styling and providers in `src/app/layout.tsx` and `src/app/providers.tsx`.

## Data Model Reminders

- Provided schema expectations for restaurants, operating hours, service periods, zones, table inventory, and allowed capacities must be reflected in onboarding forms and API payloads.

## Constraints & Policies

- Root `agents.md` (lowercase) present; repo expects root `/AGENTS.md` per instructions.
- Supabase is remote-only; follow existing service client patterns and avoid local migrations.

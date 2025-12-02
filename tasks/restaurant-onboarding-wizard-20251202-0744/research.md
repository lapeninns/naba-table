---
task: restaurant-onboarding-wizard
timestamp_utc: 2025-12-02T07:46:28Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: [feat.onboarding-wizard]
related_tickets: []
---

# Research: Restaurant Sign-up & Onboarding Wizard

## Requirements

- Functional:
  - Replace `/auth/signup` placeholder with real account creation (email+password or magic link) and handoff into onboarding.
  - Build 6-step onboarding: 1) Account creation, 2) Restaurant profile (name, slug, timezone, contacts, booking policy, slot defaults), 3) Weekly operating hours, 4) Service periods (Lunch/Dinner/Drinks etc.), 5) Zones & tables (areas, capacities, min/max party), 6) Review & launch activation.
  - Back-end routes per spec (`/api/auth/signup`, `/api/onboarding/restaurant[...]`) with zod validation, CSRF, Supabase service client.
  - Persist data into existing tables: restaurants, restaurant_operating_hours, restaurant_service_periods, zones, table_inventory, allowed_capacities.
  - Resume mid-onboarding via `/onboarding` redirecting to current step.
- Non-functional (a11y, perf, security, privacy, i18n):
  - WCAG keyboard/focus, visible states, semantic forms; respect `aria-live` for status.
  - CSRF + rate limits on auth/signup; avoid secrets in source; Supabase remote-only.
  - Perf budgets per AGENTS (mobile: FCP≤2s etc.); avoid CLS from forms; progressive enhancement where possible.
  - Localization not required today; keep copy centralized for future i18n.

## Existing Patterns & Reuse

- Wizard pattern: `reserve/features/reservations/wizard/*` provides `WizardProvider`, `WizardStep`, `WizardProgress`, `WizardNavigation`, reducer/actions store; good for multi-step state + a11y progress. Will adapt for 6 steps.
- Forms: `components/ops/restaurants/RestaurantDetailsForm` (manual state) + `components/auth/GuestSignInForm` (react-hook-form + zod + status handling) show validation and UI style to follow. `CreateRestaurantDialog` shows slug generation and capacity handling.
- Ops services/APIs already exist for profile, hours, service periods, zones, tables, allowed capacities (`src/app/api/ops/restaurants/...`, `src/services/ops/*`, `server/restaurants/*`). We can reuse domain functions (`createRestaurant`, `updateOperatingHours`, `updateServicePeriods`, zone/table services) inside onboarding APIs to avoid duplication.
- Auth patterns: `/api/auth/signin` uses CSRF validation, hostname-aware redirect building, rate limits, password strength via `lib/security/passwordPolicy`, Supabase auth OTP/password flows, `/api/auth/callback` for magic-link session exchange.
- Layout/providers: Ops area uses `OpsServicesProvider` + `OpsSessionProvider` under `src/app/app/(app)/layout.tsx`. Public/auth routes rely on root `AppProviders` only; onboarding may need its own layout/provider for wizard state and query client.
- UI kit: Shadcn components (`Card`, `Form`, `Input`, `Select`, `Switch`, `Checkbox`, `Button`, `Alert`, `Badge`, `Separator`, `Tabs`), helper `HelpTooltip`, `cn`, `Progress` etc. available.

## External Resources

- Supabase CLI connected (project ref `mqtchcaavsucsdjskptc`, linked). Pulled remote schema (schema-only) to `tasks/restaurant-onboarding-wizard-20251202-0744/artifacts/remote_schema.sql`; table list in `tasks/restaurant-onboarding-wizard-20251202-0744/artifacts/remote_tables.txt` (43 tables incl. restaurants, restaurant*operating_hours, restaurant_service_periods, zones, table_inventory, allowed_capacities, restaurant_memberships, restaurant_invites, profiles, booking*\* etc.).
- Supabase CLI version 2.62.10; Docker running to enable pg_dump. No migrations planned yet.

## Constraints & Risks

- Supabase remote-only rule; must not spin local DB. Auth/signup must honor CSRF + rate limits; password policy requires ≥12 chars, number, symbol.
- Slug uniqueness required (check/create with retry logic in `server/restaurants/create`). Need deterministic slug generation in UI to avoid clashes.
- Operating hours & service periods validations already enforce time order; onboarding UI must prevent overlaps (service periods overlap check in `server/restaurants/servicePeriods.assertNoOverlappingPeriods`).
- Zones/tables creation requires restaurantId; membership must exist (createRestaurant inserts owner membership). Must handle idempotent submissions to avoid duplicate inserts when user refreshes.
- Onboarding progress persistence is unspecified; risk of losing state between steps if only client-side. Need a server-backed indicator (e.g., onboarding_status column or use presence of required records). Lacking schema field is a blocker to reliable resume; needs decision.
- Email verification / magic-link flow timing: Supabase signUp may require email confirmation; ensure redirect/callback works with `redirectedFrom` and root domain handling.
- UI QA required via Chrome DevTools MCP for new pages; perf/a11y budgets must be met.

## Open Questions (owner, due) — RESOLVED

### Q1: Onboarding progress tracking — dedicated column vs. infer from data?

**Decision: Infer from data presence (no new column).**

**Rationale:**

- Existing schema has no `onboarding_status` column on `restaurants` table (verified in schema dump).
- Adding a column would require a migration, approval window, and rollback plan per AGENTS policy.
- Data presence is deterministic and reliable:
  1. Restaurant row exists? → past step 2
  2. Has ≥1 `restaurant_operating_hours` row? → past step 3
  3. Has ≥1 `restaurant_service_periods` row? → past step 4
  4. Has ≥1 `zones` + `table_inventory` row? → past step 5
  5. `restaurants.is_active = true`? → onboarding complete (step 6 done)
- Resume logic: fetch these counts and route user to first incomplete step.
- Risk: edge case where user creates partial data then abandons; acceptable since no PII is leaked and cleanup can be scheduled later.

---

### Q2: Service periods — fixed set or dynamic from `booking_occasions`?

**Decision: Dynamic from `booking_occasions` catalog; no per-day overrides during onboarding.**

**Rationale:**

- `restaurant_service_periods.booking_option` has a FK to `booking_occasions(key)` (see schema line 9749).
- `server/restaurants/servicePeriods.ts` validates against the live `booking_occasions` catalog via `getOccasionCatalog()`.
- Current seeded occasions: `lunch`, `dinner`, `drinks` (see `init-seeds-waterbeach.sql`), but catalog is extensible.
- Service periods already support `day_of_week` (nullable for "all days"), so per-day override is technically possible, but for onboarding simplicity:
  - Default to `day_of_week = null` (applies to all days).
  - Full per-day customization can be done in ops settings post-onboarding.
- Onboarding UI: show dropdown of active `booking_occasions` from catalog; user sets start/end times per occasion.

---

### Q3: Operating hours — overrides during onboarding?

**Decision: Weekly schedule only during onboarding; overrides deferred to ops settings.**

**Rationale:**

- `OperatingHoursSnapshot` type (in `src/services/ops/restaurants.ts`) has `weekly[]` and `overrides[]`.
- Overrides are date-specific exceptions (holidays, special events)—not relevant at initial setup.
- Onboarding step 3 collects a simple weekly schedule (Mon–Sun open/close times).
- Users can add overrides later via the existing `/app/(app)/[slug]/settings/hours` UI.
- Keeps onboarding focused and reduces cognitive load.

---

### Q4: Allowed capacities in onboarding?

**Decision: Skip during onboarding; auto-generate defaults from table inventory.**

**Rationale:**

- `allowed_capacities` table stores (restaurant_id, capacity) pairs defining which party sizes are bookable.
- Current pattern: `allowed_capacities` is populated after tables exist, often derived from table min/max capacities.
- During onboarding step 5/6, user creates zones + tables with capacities.
- After step 5 completes, we can auto-generate `allowed_capacities` as the union of all table capacities (1 to max single-table capacity, or combined if grouping allowed).
- Default: insert capacities 1 through the largest single-table capacity (e.g., if max table is 8, insert 1–8).
- Advanced configuration (e.g., excluding party size 1, allowing 10+ via table combining) is deferred to ops settings.

---

### Q5: Email confirmation before onboarding?

**Decision: Allow session immediately for password signup; require confirmation for magic-link.**

**Rationale:**

- Existing invitation-accept flow uses `email_confirm: true` in `createUser` / `updateUserById` (see `route.ts` line 124/136), which auto-confirms the email when admin creates user.
- For self-service signup:
  - **Password mode**: Use `supabase.auth.signUp({ email, password })` which creates user + session immediately. Supabase default may send a confirmation email, but user is not blocked from proceeding. We can set `email_confirm: true` via service role if we want to skip confirmation entirely (matches invite flow).
  - **Magic-link mode**: User must click the link to authenticate, so confirmation is implicit.
- Security trade-off: immediate session allows faster onboarding; email is verified implicitly because user must receive emails for booking confirmations anyway.
- Recommendation: auto-confirm email on password signup (via admin API with `email_confirm: true`) to unblock onboarding; display a banner prompting email verification later if needed for other features.

---

_All questions resolved 2025-12-02. Proceed to plan.md._

## Recommended Direction (with rationale)

- Implement onboarding as a dedicated route group `src/app/(onboarding)` with a shared client-side wizard provider (reducer-based, adapted from reserve wizard) storing step data and handling navigation; persist to server at each step via onboarding APIs to allow resuming.
- Reuse domain services: onboarding API handlers should call `createRestaurant`, `updateOperatingHours`, `updateServicePeriods`, zone/table services, and `allowed_capacities` endpoints to keep business rules consistent; wrap with onboarding-specific auth (owner-only) and CSRF.
- Build `/api/auth/signup` mirroring signin patterns: zod-validated payload for mode=magic_link|password, rate limits, password policy, host-aware redirect to `/onboarding/profile` (step 2) on success, using Supabase `signUp` / `signInWithOtp({ shouldCreateUser: true })`.
- UI: Use react-hook-form + zod for signup and profile; leverage existing form components and validation logic from `RestaurantDetailsForm` and settings sections but slimmed for onboarding. Apply Shadcn cards and progress indicator for clarity and a11y.
- Persistence: after each step, store restaurantId and server-sourced snapshots in wizard context; fetch existing data when user revisits (resume). If no explicit onboarding flag, infer current step from record completeness (e.g., restaurant exists? has hours? has service periods? has at least one zone+table?). Document this heuristic and risks.

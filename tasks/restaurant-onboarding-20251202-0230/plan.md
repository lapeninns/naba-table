---
task: restaurant-onboarding
timestamp_utc: 2025-12-02T02:30:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Sign-up & Onboarding Wizard

## Objective

Replace the invite-only placeholder with a full self-serve onboarding wizard for new restaurant owners, covering account creation through restaurant setup (profile, hours, service periods, zones/tables) and finishing with a review/launch step.

## Success Criteria

- [ ] `/auth/signup` renders the new wizard entry (account creation step) with validation and error handling.
- [ ] `/onboarding` routes handle step-by-step flow (profile, hours, service periods, tables, review) with persisted state across steps.
- [ ] API endpoints for onboarding (signup, restaurant creation, hours, service periods, zones, tables, completion) validate input via zod and use Supabase service clients with CSRF protection.
- [ ] Wizard UI follows existing booking wizard patterns (provider, step navigation, progress) and Shadcn components; accessible and responsive.
- [ ] Manual QA captures Chrome DevTools MCP evidence for primary flows.

## Approach

1. **Foundations & State**
   - Create onboarding domain (types, zod schemas, reducer, context) mirroring `reserve/features/reservations/wizard` patterns but tailored to onboarding steps (6-step state machine and loading/error flags).
   - Include helpers for slug generation, timezone defaults, and mapping form values to API payloads.

2. **API Layer**
   - Implement `POST /api/auth/signup` for owner creation (email/password or magic link) with CSRF + rate-limit analogs from sign-in route.
   - Add onboarding endpoints under `/api/onboarding/restaurant` for create/update of profile, hours, service periods, zones, tables, and completion flags using Supabase service clients and zod validation.

3. **Wizard UI**
   - Build shared components (progress, navigation, layout) using Shadcn cards/steps modeled after existing wizard UI.
   - Implement per-step forms:
     - Account creation (email/password or magic link choice).
     - Restaurant profile (name, slug, timezone, contact info, booking policy options).
     - Operating hours (weekly open/close with closed toggles).
     - Service periods (add/edit rows for day-of-week windows + booking option).
     - Zones & tables (zones list with zone type, tables list with capacity/party sizes/category fields).
     - Review & launch summary with submit.
   - Wire forms to context actions and API mutations; include optimistic state updates and error banners.

4. **Routing & Guards**
   - Add `/auth/signup` page that initializes wizard and directs authenticated users to appropriate onboarding step.
   - Add `/onboarding` + step routes that fetch persisted state (if restaurantId exists) and hydrate wizard context.
   - Ensure redirects to dashboard after completion.

5. **Tests & Verification**
   - Unit tests for reducers/mappers/schemas where feasible.
   - Manual QA via Chrome DevTools MCP: run through signup → profile → hours → review flow.

## Dependencies & Risks

- Supabase account creation policies/SMTP for magic links; may need to stub fallback UX if emails cannot send in test environment.
- Large surface area across API, state, and UI; risk of partial implementations or regressions in existing auth routes.
- Timezone and time validation edge cases across steps.

## Rollout

- Ship behind onboarding flow entry points. If issues arise, revert new routes/pages and restore invite-only placeholder.

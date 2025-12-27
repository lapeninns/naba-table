---
task: restaurant-onboarding
timestamp_utc: 2025-12-02T02:30:00Z
owner: github:@assistant
---

# TODO

- [x] Research existing wizard patterns (`reserve/features/reservations/wizard`) and onboarding-relevant forms (restaurant settings sections).
- [x] Design onboarding state machine, zod schemas, and context/actions.
- [x] Implement API routes for signup and onboarding steps with Supabase patterns and CSRF.
- [x] Build wizard UI components (layout, progress, navigation) leveraging Shadcn.
- [x] Implement step forms (account, profile, hours, services, zones/tables, review) with validations and API wiring.
- [x] Add routing for `/auth/signup` and `/onboarding/*` with hydration/redirection logic.
- [ ] Write tests for reducers/helpers and smoke test endpoints where feasible.
- [ ] Manual QA via Chrome DevTools MCP and capture evidence.
- [ ] Prepare PR summary referencing task folder.

# ADR-0001: Reserve App Architecture Migration

- **Status**: Accepted
- **Date**: 2025-01-14
- **Context**: The legacy `/reserve` flow lived inside `components/reserve` as a monolithic Next.js client component. The lack of modularity, caching, and strict typing hindered iteration speed and made testing difficult.
- **Decision**:
  1. Introduce a feature-sliced workspace under `reserve/` with React Router data routes, TanStack Query, and strict TypeScript enforced via `tsconfig.reserve.json`.
  2. Mount the new app inside the Next.js shell through a feature flag (`NEXT_PUBLIC_RESERVE_V2`) to enable gradual rollout.
  3. Normalize API responses with Zod adapters and centralize HTTP concerns in `@shared/api/client`.
  4. Adopt hooks-first design (`useReservationWizard`) to separate orchestration from presentational UI, with tests colocated per feature.
- **Consequences**:
  - Pros: clear boundaries, improved caching, testability, and DX (lint, Husky, Vitest, Playwright).
  - Cons: temporary duplication while the legacy flow co-exists; requires additional build tooling (Vite) and dependency overhead.
  - Follow-up: migrate remaining helper utilities from `components/reserve` into feature slices, expand MSW handlers, and flesh out reservation list/details routes.

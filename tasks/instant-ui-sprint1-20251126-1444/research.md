---
task: instant-ui-sprint1
timestamp_utc: 2025-11-26T14:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Sprint 1 — Make the App Feel Instant

## Requirements

- Functional:
  - Implement optimistic UI for toggles and booking status changes so UI updates instantly on user action with rollback on error.
  - Standardize mutation pattern (onMutate snapshot, error rollback, settled invalidation).
  - Tune React Query staleTime/cacheTime per data type to reduce over-fetching without staleness regressions.
  - Provide skeleton loaders for key screens (settings, booking list, calendar) that match layouts and minimize CLS.
  - Add error boundaries per main route with friendly error UI and retry.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Skeletons and loading states must maintain layout and focus order; ensure visible focus and aria-live for toasts.
  - Perf: target near-instant perceived responses; keep interaction P95 ≤ 500 ms for optimistic flows; avoid extra network calls from low staleTime.
  - Security/privacy: no secret leakage in logs; adhere to existing auth/authorization; avoid exposing error details in UI.
  - i18n: reuse existing copy patterns; avoid hard-coded locale-specific formatting beyond project norms.

## Existing Patterns & Reuse

- Query/mutation utilities likely exist under `src/hooks` and `src/lib`; need inventory of existing React Query setup, query keys, toast utilities, and error components.
- Skeleton components may exist in `components` or `src/components`; verify before adding new ones to avoid duplication.
- Toast system: check for `react-hot-toast` usage or Radix Toast via Shadcn; reuse if present.
- Booking/status mutation hooks likely in `src/hooks` or feature-specific services; map before refactors.

## External Resources

- TanStack Query v5 official docs for optimistic updates and cache configuration — to confirm recommended patterns and default behaviors.
- WCAG/WAI-ARIA guidelines for loading indicators and error messaging — to ensure accessibility in skeletons and error UIs.

## Constraints & Risks

- Risk of inconsistent cache invalidation causing stale booking data; must map query keys carefully.
- Introducing optimistic updates may cause double updates if invalidations overlap; need deterministic rollback and refetch rules.
- Skeleton components risk visual mismatch with existing design system; must align with Shadcn/tailwind tokens.
- Error boundaries may hide errors during development if not logged; ensure console logging remains.

## Open Questions (owner, due)

- Do we already have a global toast provider? (owner: self, due: analysis)
- Is there a shared query client config (staleTime defaults) that we should tune globally vs per-query? (owner: self)
- Where are main routes defined (Next App Router vs Pages) to place error boundaries? (owner: self)
- Are booking mutations server actions or API routes; do they require auth context handling? (owner: self)

## Recommended Direction (with rationale)

- Standardize query keys in a central `queryKeys` helper and refactor existing hooks to use it; improves invalidate/refetch consistency.
- Adopt a single optimistic mutation helper pattern wrapping TanStack onMutate/onError/onSettled for toggles and booking status changes; reduce repeated code.
- Set staleTime by data volatility: profile/hours 5–10m; table/zone/occasion 2–5m; bookings/schedule 30–120s; customers 5m; adjust cacheTime accordingly.
- Introduce skeleton primitives aligned with existing spacing/rounded tokens; replace spinners on target pages to maintain layout and reduce CLS.
- Add route-level error boundaries with friendly messaging and retry callbacks that trigger relevant query invalidations or reset boundaries; log errors to console.

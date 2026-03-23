---
task: fix-posthog-runtime-errors
timestamp_utc: 2026-03-23T14:33:34Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix PostHog Runtime Errors

## Objective

We will harden the guest booking flow and ops-side cache updates so that known active PostHog runtime errors stop crashing the UI and recover gracefully from partial data shapes.

## Success Criteria

- [ ] Active first-party PostHog matches no longer rely on unsafe `.length`, `.map`, `.find`, or `.toLowerCase()` assumptions.
- [ ] Public booking wizard tolerates partial schedule payloads without crashing.
- [ ] Targeted regression tests cover the new boundary guards.

## Architecture & Components

- `reserve/features/reservations/wizard/services/schedule.ts`
  - Normalize API payloads at the guest schedule boundary.
- `src/components/features/ops-shell/OpsRestaurantSwitch.tsx`
  - Normalize nullable restaurant names before search/display.
- Cache mutation hooks:
  - `hooks/useUpdateBooking.ts`
  - `hooks/useCancelBooking.ts`
  - `hooks/ops/useUpdateRestaurant.ts`
  - `src/hooks/ops/useOpsBookingStatusActions.ts`
  - Skip optimistic list patching when cached data is not the expected list shape.

## Data Flow & API Contracts

- `GET /restaurants/[slug]/schedule`
  - Client will defensively normalize array/object fields before wizard consumers read them.
- React Query cache writes
  - Only mutate list payloads when `items` is an array.

## UI/UX States

- Public booking page should continue rendering with unavailable/empty slot states instead of throwing.
- Ops restaurant switch search should still work even when a membership name is empty or missing.

## Edge Cases

- Schedule payload missing `slots`, `availableBookingOptions`, or `occasionCatalog`.
- Cached query data with stale or unexpected shapes during optimistic mutation windows.
- Memberships with blank or nullish restaurant names.

## Testing Strategy

- Unit:
  - schedule normalization helper
  - booking mutation hooks with malformed cache payloads
- Verification:
  - `pnpm run typecheck`
  - targeted Vitest runs
  - Chrome DevTools MCP smoke test on the public booking page

## Rollout

- No feature flag; direct hardening of existing code paths.
- Monitor PostHog issue IDs from the audit task after deploy:
  - `019cf7df-8438-7d13-bbdb-889af9c4dd90`
  - `019c2465-c87d-7bd3-9dde-7388712ad2b7`
  - `019c244a-1947-7913-9be6-f537f7747646`
  - `019c248b-2bc7-72e1-8caf-428cbd208809`

## DB Change Plan (if applicable)

- No database changes.

---
task: browse-partner-restaurants-revamp
timestamp_utc: 2025-11-23T01:06:47Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Browse partner restaurants revamp

## Objective

Deliver a minimal, content-rich restaurant directory section so visitors can skim partner venues quickly and jump into booking with key details visible.

## Success Criteria

- [ ] List layout shows richer details per restaurant (address, timezone, capacity, booking policy/contact) pulled from DB.
- [ ] Error, empty, and loading states remain accessible (aria-live, keyboard friendly) with concise copy.
- [ ] Booking CTA still works and analytics events fire for view/error/selection.
- [ ] UI responsive (1 column mobile, 2 columns desktop) with minimal styling.

## Architecture & Components

- Reuse `RestaurantBrowser` component but simplify markup to list of compact cards.
- Keep `useRestaurants` hook + React Query caching.
- Continue using Shadcn primitives (`Card`, `Badge`, `Button`) but lean styling.

## Data Flow & API Contracts

- Expand `RestaurantSummary` to include optional details: `address`, `contactEmail`, `contactPhone`, `googleMapUrl`, `bookingPolicy`, `logoUrl`, `isActive`.
- Update `listRestaurants` selection + `/api/v1/restaurants` response to return these fields.
- Other consumers can continue using the type (fields optional), no request parameter change.

## UI/UX States

- Loading: skeleton rows matching new list shape.
- Success: list of restaurants with CTA, detail list, subtle chips for capacity/timezone.
- Empty: friendly message with refresh + contact support.
- Error: inline alert with retry + mailto support.

## Edge Cases

- Null/empty address or booking policy → hide row labels gracefully.
- Missing contact info → omit contact block.
- Long booking policy → clamp to 2 lines with accessible full text via title.
- `is_active === false` → optionally show muted badge; still visible but flagged.

## Testing Strategy

- Manual UI QA via Chrome DevTools MCP on /restaurants (desktop + mobile, keyboard flows).
- Smoke check React Query data load; ensure analytics hooks still triggered.
- Run lint or targeted tests if time permits.

## Rollout

- No feature flag; ships with page render.
- Revert path: restore previous component from git if issues.

## DB Change Plan (if applicable)

- Read-only; no schema changes or migrations.

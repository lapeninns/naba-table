---
task: booking-occasions-crud
timestamp_utc: 2025-11-25T14:07:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking occasions CRUD in settings

## Objective

Enable ops users to manage booking occasions (global + per-restaurant overrides) directly from the restaurant settings UI so reservation flows always reflect current, permitted occasions.

## Success Criteria

- [ ] Ops UI at /settings/restaurant lists occasions with active state, duration, availability summary, and order.
- [ ] Users with permission can create, edit, reorder, activate/deactivate occasions; key remains immutable.
- [ ] Soft-delete or deactivate is blocked if referenced by service periods or future bookings unless explicitly remapped/confirmed.
- [ ] API enforces RBAC and logs audit entries for create/update/delete/reorder.
- [ ] Reservation schedule continues to surface accurate occasionCatalog with overrides applied.

## Architecture & Components

- Backend API (ops): extend `/api/ops/occasions` with GET/POST/PATCH/DELETE and `/reorder`; add reference checks and audit logging.
- Data model: retain `booking_occasions` (global); add `restaurant_occasions` for optional overrides; add columns `is_builtin`, `deleted_at`, audit fields; keep `key` immutable.
- UI: Settings page section with table + drag-and-drop reorder + inline toggle + “Edit/New” drawer form; confirmation modals for risky actions.
- Hooks/services: extend `src/services/ops/occasions.ts` + React Query hooks for CRUD and reorder; reuse existing query keys.
- Validation/util: reuse `@reserve/shared/occasions` for availability parsing; add server-side guards for key immutability and reference checks.

## Data Flow & API Contracts

- GET `/api/ops/occasions?restaurant_id=` → merged list (global + overrides) with effective fields and metadata (is_builtin, reference counts optional).
- POST `/api/ops/occasions` → create global; body excludes `id`, `key` unique, sets `display_order`.
- PATCH `/api/ops/occasions/:id` → update editable fields; reject key change; optional `restaurant_id` to upsert override.
- DELETE `/api/ops/occasions/:id` → soft-delete; fails if referenced by service periods or future bookings unless `force_with_replacement` provided (optional follow-up).
- POST `/api/ops/occasions/reorder` → [{id, display_order}] persisted transactionally.
- Audit captured server-side with `changed_by`, diff snapshot.

## UI/UX States

- Loading, empty (call to action), list populated, edit/create drawer, deactivate confirmation, delete blocked modal with reference summary, reorder success/failure toasts.

## Edge Cases

- Attempt to delete builtin occasion → block with message.
- Attempt to change key → 400.
- Overrides: when restaurant override absent, fall back to global values.
- Deactivated occasions still needed for historical bookings → keep visible with badge and disable selection in new bookings.
- Availability JSON invalid → validation error; default to always available if omitted.

## Testing Strategy

- Unit: API handlers validate key immutability, RBAC, reference checks, reorder ordering logic.
- Integration: create/edit/deactivate flows via ops services; ensure schedule endpoint returns updated catalog.
- UI: React Testing Library for table rendering, drawer form validation, reorder interaction, guarded delete.
- A11y: axe on settings section; keyboard reorder path.

## Rollout

- Feature flag: `feat.ops.booking_occasions_crud` (default on for ops env).
- Exposure: ops only; no guest-facing change aside from updated catalog.
- Monitoring: log audit entries and API errors; track occurrence of blocked deletes.
- Kill-switch: disable flag to hide UI and block mutating endpoints.

## DB Change Plan (if applicable)

- Create migrations (remote only) to add `is_builtin`, `deleted_at`, audit fields to `booking_occasions`; create `restaurant_occasions` and audit table; add policies/RLS.
- Apply to staging first; capture diff in `artifacts/db-diff.txt`; ensure rollback script (drop new table/columns or revert policies).

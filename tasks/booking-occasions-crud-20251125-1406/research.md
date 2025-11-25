---
task: booking-occasions-crud
timestamp_utc: 2025-11-25T14:07:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking occasions CRUD in settings

## Requirements

- Functional: Provide CRUD UI in app.localhost:3000/settings/restaurant to manage booking occasions shown in reservation flows; list, create, edit, reorder, toggle active; block unsafe delete when referenced; support RBAC (admins for global, restaurant managers for overrides); expose API endpoints under /api/ops/occasions.
- Non-functional: Accessibility (keyboard-friendly table/drawer, focus management), audit logging, security with RBAC, remote Supabase only, maintain performant queries, responsive layout.

## Existing Patterns & Reuse

- Occasion data currently loaded from Supabase table `booking_occasions` via `server/occasions/catalog.ts` and injected into schedule responses in `server/restaurants/schedule.ts`.
- Seeds include extra occasions (christmas_party, curry_and_carols) showing up in UI because they are active; seed file at `supabase/seed.sql`.
- Shared types and helpers in `@reserve/shared/occasions` already model availability rules; wizard UI maps catalog definitions directly.
- Ops service plumbing exists at `/api/ops/occasions` (read-only) and `src/services/ops/occasions.ts`; can extend.

## External Resources

- Internal codebase only; Supabase remote per policy. No external docs needed yet.

## Constraints & Risks

- Must adhere to root AGENTS: task folder required, remote Supabase only, accessibility, manual QA via DevTools for UI changes.
- Key should remain immutable to avoid breaking references; deletions must be soft and validated against references.
- Need RBAC enforcement server-side; confirm roles mapping in auth layer.
- Availability editor complexity: start with weekly/always-available to control scope.
- Migrations must run staging first with rollback plan.

## Open Questions (owner, due)

- Supabase project IDs/URLs for staging & prod? (owner: maintainers, due: before migrations).
- Which roles map to "org admin" and "restaurant manager" in existing auth? (owner: maintainers).
- Are lunch/drinks/dinner considered builtin/non-deletable? (owner: product/PM).

## Recommended Direction (with rationale)

- Keep canonical `booking_occasions` as global definitions; add `restaurant_occasions` overrides for per-restaurant display_order/label/availability/is_active when needed.
- Add fields: `is_builtin`, `deleted_at`, `created_by`, `updated_by`; enforce key immutability.
- Build ops UI in settings: table + drawer form, drag/drop reorder, is_active toggle, guarded delete with reference checks and audit reason.
- Extend `/api/ops/occasions` with CRUD + reorder endpoints; apply RBAC checks; record audit rows.
- Start availability editor with always-available + weekly time windows; allow JSON fallback for advanced rules later.

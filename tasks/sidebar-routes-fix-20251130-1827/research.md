---
task: sidebar-routes-fix
timestamp_utc: 2025-11-30T18:27:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix restaurant sidebar routes

## Requirements

- Functional: restaurant-facing sidebar links should navigate to working pages using the `/app/...` path (e.g., `/app/dashboard`, `/app/bookings`).
- Non-functional: preserve current look/feel and a11y; avoid breaking auth or feature-flag visibility logic.

## Existing Patterns & Reuse

- Sidebar items are defined centrally in `src/components/features/ops-shell/navigation.tsx` and consumed by `OpsSidebarLayout` → `OpsShell` → `app/(app)/*` pages.
- Restaurant routes live under `src/app/app/(app)/**`, meaning the public path already includes the `/app` segment (top-level folder) while the `(app)` group is URL-neutral.
- `isNavItemActive` helpers already exist for active state handling; only `href` values need alignment.

## External Resources

- None required; codebase provides necessary context.

## Constraints & Risks

- Must not change guest-facing or marketing routes.
- Ensure redirects (e.g., sign-out) still point to valid auth pages once `/app` prefix is applied.
- Keep feature-flag filtering intact.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Update `OPS_NAV_SECTIONS` hrefs (and any related auth redirect within the ops shell) to include `/app` prefix, matching actual route locations under `src/app/app/(app)/`. This centralized change should fix all sidebar links without touching page components.

---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@web-core
profile: web-hooks
---

# AGENTS.md — Legacy Hooks (`hooks/`)

> Inherits root `/AGENTS.md`. Applies to top-level React hooks under `hooks/**` (legacy/shared), distinct from `src/hooks/**`.

## Overview

- Houses long-lived hooks still referenced by the booking wizard and ops dashboards:
  - `useBookings.ts`, `useBookingsTableState.ts`, `useUpdateBooking.ts`, `useCancelBooking.ts`
  - Ops-specific helpers under `hooks/ops/**` (e.g., `useOpsBookings.ts`, `useOpsCustomers.ts`, `useOpsUpdateBooking.ts`)
  - Owner/marketing helpers (`hooks/owner/**`, `useGuestPreferences.ts`, `useProfile.ts`, `useSupabaseSession.tsx`)
- Some hooks proxy to their `src/hooks/**` equivalents. Track migrations in task notes so consumers are updated in lockstep.

## Guidelines

1. **Migration-first mindset**
   - Prefer implementing net-new hooks inside `src/hooks` and only touch this directory when editing legacy flows or when consumers have not yet been migrated.
   - When updating a legacy hook, document whether `src/hooks` has a counterpart and outline a migration follow-up if needed.
2. **Side-effect boundaries**
   - Keep Supabase/API operations funneled through `lib/` or `src/services/ops` helpers; these hooks should orchestrate responses, not house fetch logic.
   - Hooks like `useSupabaseSession.tsx` that necessarily talk to Supabase must remain the single source of truth—extend them rather than sprinkling auth logic elsewhere.
3. **Type safety & stability**
   - Many consumers (Guest + Ops UIs) rely on these return types. Use shared types from `src/types/ops.ts` or local DTOs; avoid breaking changes without a coordinated migration plan.
   - Maintain memoization for heavy selectors (`useBookingsTableState`), and ensure loading/error states remain backwards-compatible.

## Build & Test Commands

- `pnpm lint hooks/**` (or repository-wide `pnpm lint`) — enforce consistent lint rules.
- `pnpm typecheck` — verify cross-package consumers still compile.
- `pnpm test --filter hooks` (or targeted Vitest files) — cover non-trivial transitions (booking edits, optimistic updates, session refresh paths).

## Testing & QA

- When a hook change affects network chatter (e.g., booking mutations or Supabase session refresh), run Chrome DevTools MCP against the impacted route and capture HAR + Lighthouse artifacts per root policy.
- For ops flows, run at least one Playwright guest/ops spec that exercises the updated hook and attach the trace in the task folder.

## Links

- Root AGENTS: `/AGENTS.md`
- Newer hooks: `src/hooks/**`
- Services: `lib/**`, `src/services/ops/**`
- Contexts: `src/contexts/**`

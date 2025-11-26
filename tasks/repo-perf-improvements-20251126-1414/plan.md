---
task: repo-perf-improvements
timestamp_utc: 2025-11-26T14:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Repo-Wide Performance Improvements

## Objective

Improve perceived and real performance across the app by implementing the 15 scoped initiatives (optimistic UI, caching/prefetching, loading UX, code splitting, input tuning, memoization, network hygiene, asset optimization, error recovery, accessibility) without regressions to booking and settings workflows.

## Success Criteria

- UI actions (toggles, create/delete, booking status) reflect instantly via optimistic cache updates with safe rollback; no stale artifacts after errors.
- Data fetches reduced: ≥30% fewer network requests on common navigation (measured via React Query Devtools sampling) and no redundant refetch loops.
- Initial route LCP and JS payload improved: primary pages show smaller main bundle and code-split chunks for heavy features; skeletons replace spinners on key screens.
- Keyboard-only flows remain intact; shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+N, Esc) work in scoped contexts without browser conflicts.
- Accessibility maintained/enhanced (aria-busy on loading regions, focus return on modal close, respects prefers-reduced-motion).

## Architecture & Components

- **Data layer**: TanStack Query v5; introduce/align `queryKeys` helper if missing; use `useMutation` with `onMutate/onError/onSettled` for optimistic updates; `prefetchQuery` on hover/focus or step transitions.
- **UI shell**: Next.js layout; add Suspense boundaries per page section; skeleton components built with existing Tailwind/Radix primitives (no Shadcn).
- **Shortcuts**: Global listener in app shell (respecting focus/active modal) plus scoped handlers in forms/modals to avoid conflicts; utility hook `useShortcut` if needed.
- **Code splitting**: Next `dynamic()` for heavy sub-features (settings tabs, booking wizard steps, analytics/charts, heavy modals). Bundle analyzer to validate.
- **Forms**: Standardize on React Hook Form (already present); use `mode: 'onBlur'` where reasonable; minimize controlled fields; use `useWatch` for derived values.
- **Animation**: CSS transforms/opacity only; apply `prefers-reduced-motion` guard; use `will-change` sparingly.
- **Error boundaries**: Route/feature-level error boundaries (Next App Router error file or react-error-boundary) with retry.

## Data Flow & API Contracts

- No API contract changes expected. Mutations must handle optimistic payload shape: temporary IDs for creations, local status changes, and rollbacks on error. Use server-provided IDs to reconcile.

## UI/UX States

- Loading: skeletons per view (lists, forms, cards); aria-busy on containers.
- Success: optimistic state reconciled with server data post-settled refetch if needed.
- Error: inline error states and toasts; error boundaries provide retry/reset; undo toast for destructive actions where feasible.

## Edge Cases

- Rapid toggle spam causing race conditions: cancel in-flight queries via `queryClient.cancelQueries` and consider disabling control while mutation in flight.
- Prefetch cache staleness: ensure `staleTime` set so prefetched data stays fresh during expected navigation window; avoid over-prefetching.
- Keyboard shortcut conflicts with browser (Ctrl+N): scope to app shell and skip when modifiers not desired or when input elements are focused (except intended forms for Ctrl+S).
- Suspense + React Query: use selectively; fall back to manual loading states where instability observed.

## Testing Strategy

- Unit: hooks/utilities (optimistic update functions, debounce/throttle helpers, shortcut handler guards).
- Integration: key flows (toggle zone, create/delete table, booking status change) verifying optimistic cache + rollback.
- Accessibility: axe/Storybook a11y check for skeletons and aria-busy, keyboard nav for shortcuts and modals.
- Performance sampling: React Query Devtools request counts; Next bundle analyzer for chunk sizes; Lighthouse for LCP/JS size impact after changes.
- Manual QA: Chrome DevTools MCP per policy (mobile/desktop, perf timeline for animations, network tab for duplicate calls).

## Rollout

- Feature flags: none planned; changes are incremental. If needed, gate shortcuts with env flag `NEXT_PUBLIC_ENABLE_SHORTCUTS`.
- Deployment: standard Next build; verify on staging with real data. No DB migrations.
- Monitoring: watch error logs for mutation failures; React Query Devtools in staging; collect Lighthouse JSON in `artifacts/` during verification.

## DB Change Plan

- Not applicable (no schema changes). Supabase untouched aside from existing remote environments.

## Notes / Assumptions

- Query keys are or will be centralized; if absent, create minimal `queryKeys` helper without broad refactor.
- Skeleton styling will reuse existing Tailwind tokens; no new design system introduced.
- Image optimization will leverage Next/Image where feasible without changing storage backend.

---
task: smooth-nav-inputs
timestamp_utc: 2025-11-26T15:04:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Sprint 2 — Smooth Navigation & Inputs

## Objective

Make navigation and input-heavy flows feel instant via smart prefetching, scoped keyboard shortcuts, debounced inputs, and performant forms.

## Success Criteria

- [ ] Prefetching reduces visible loading on targeted navigations (settings sidebar, wizard next step, dashboard tabs, calendar next month, restaurant switcher).
- [ ] Keyboard shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+N, Esc, Cmd/Ctrl+K, arrows) work in scope without browser conflicts.
- [ ] Searches/filters fire after debounce; scroll/resize remain smooth.
- [ ] Key forms (profile, hours, service periods) render/validate without typing lag.

## Architecture & Components

- `lib/prefetchers.ts`: tiny helpers wrapping `queryClient.prefetchQuery` with guard options.
- `hooks/useGlobalShortcuts.ts`: register/unregister per scope; supports modifier-aware handlers and default prevention.
- `utils/debounceThrottle.ts`: debounce/throttle utilities; optional React hook wrappers.
- Form refactors: migrate targeted settings forms to react-hook-form; split into sections.

## Data Flow & Contracts

- Prefetch functions accept query keys + fetchers (reuse existing services). Must align with `lib/query/keys.ts`.
- Shortcuts dispatch to view-specific actions (save, new, close modal) via callbacks passed into hook.
- Debounced search/filters call existing query setters; no API contract change.

## UI/UX States

- Prefetch invisible; ensure no double spinners. Loading fallbacks remain for cache miss.
- Shortcuts expose hints in tooltips (“Save (Ctrl/Cmd+S)”).
- Forms: validation on blur/submit; inline errors consistent with Shadcn styles.

## Edge Cases

- Prefetch when offline or errors → swallow quietly; no user-facing error.
- Shortcuts should not fire inside textareas for Ctrl+N/S unless form context is active.
- Debounce must clear on unmount to avoid setState on unmounted components.

## Testing Strategy

- Unit: debounceThrottle behavior; useGlobalShortcuts handler registration; prefetch helper calls queryClient.prefetchQuery with options.
- Integration: simulate shortcut keydown to ensure preventDefault; prefetch wiring to settings links using testing queryClient.
- Manual QA: Chrome DevTools MCP with slow network to verify prefetch hits reduce flicker; keyboard-only flows.

## Rollout

- Feature flag optional `feat.prefetch-smart` if needed; otherwise ship incrementally by area.
- Logging: console.warn on prefetch errors in dev only.

## DB Change Plan

- None.

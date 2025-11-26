---
task: smooth-nav-inputs
timestamp_utc: 2025-11-26T15:04:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Sprint 2 — Smooth Navigation & Inputs

## Requirements

- Functional: prefetch navigation targets (settings sidebar, booking wizard next step, dashboard tabs, calendar adj months, restaurant switcher); global shortcuts (Cmd/Ctrl+S save form, Cmd/Ctrl+N new item, Esc close modal, Cmd/Ctrl+K command palette, arrows to navigate lists); debounce/throttle for search/filters/scroll/resize; form performance via react-hook-form standardization.
- Non-functional: maintain accessibility (keyboard flows, focus), no double-loads or regressions, avoid network spam.

## Existing Patterns & Reuse (initial inventory)

- Prefetch: need to locate current use of `prefetchQuery` / `queryClient.prefetchQuery`. None yet (not searched fully).
- Shortcuts: check for `cmd+k`, `keydown`, `useHotkeys`, `useShortcuts` patterns.
- Debounce: search for `debounce`, `throttle`, `setTimeout` wrappers; any existing helper.
- Forms: Restaurant settings forms already use various patterns (OperatingHoursSection uses controlled state, not react-hook-form; need inventory of react-hook-form usage elsewhere).

## External Resources

- TanStack Query prefetch docs (v5) for `prefetchQuery`, `ensureQueryData` behavior.
- React Hook Form performance guidance: uncontrolled inputs, `useForm` with `mode: 'onBlur'`.
- Keyboard shortcut best practices (MDN) for preventing default browser save.

## Constraints & Risks

- Over-prefetch could add network load; need guard (enabled conditions, cacheTime).
- Shortcuts risk hijacking browser defaults; must scope and `preventDefault` conditionally.
- Debounce might delay critical updates; choose per-field timings.
- Refactoring forms may be invasive; prioritize high-lag forms.

## Open Questions

- Is there an existing command palette component to bind Cmd/Ctrl+K? (search).
- Which booking wizard steps exist and where to hook prefetch? (locate wizard files).
- Are there existing analytics on prefetch hits/ misses? (none seen).

## Recommended Direction

- Add small `lib/prefetchers.ts` exporting `prefetchSafely(queryClient, key, fn, options?)` with try/catch.
- Central `useGlobalShortcuts` hook with context to register handlers and scope; add per-view bindings.
- Add `utils/debounceThrottle.ts` simple debounced/throttled wrappers; replace ad-hoc timeouts in search/filter components.
- Incremental form refactors: start with Restaurant Profile, Operating Hours, Service Periods; migrate to react-hook-form with sectioned structure and `mode: 'onBlur'`.

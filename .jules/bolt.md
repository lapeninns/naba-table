# Bolt Journal

Critical learnings only.

## 2026-04-29 - Profile Dirty Handler Stability

**Learning:** Restaurant profile subforms run dirty-state effects that depend on `onDirtyChange`, so route components that create new dirty callbacks during render can trigger redundant dirty-effect runs across every subform.
**Action:** Prefer stable per-section dirty handlers when wiring profile settings subforms.

## 2026-04-29 - Global Shortcut Identity

**Learning:** `useGlobalShortcuts` binds a `window` keydown listener from an effect that depends on the shortcut array, so inline shortcut arrays cause listener teardown/rebind work on every render.
**Action:** Memoize shortcut arrays and handlers in route clients before passing them to `useGlobalShortcuts`.

## 2026-04-29 - Tables Summary Zone Reuse

**Learning:** The tables settings route already receives summary zones from `/api/ops/tables`, so a parallel `/api/ops/zones` request is duplicate initial-load work when the summary includes the fields the UI needs.
**Action:** Keep table summary zone DTOs rich enough for the route UI and reserve the dedicated zones query as a fallback.

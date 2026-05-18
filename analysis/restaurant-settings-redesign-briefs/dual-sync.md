# Redesign Brief: Google Business Profile & Dual Sync

## Problem

The `DualSyncShell.tsx` component is a complex 812-line screen orchestrating the import and synchronization comparisons of brand, contacts, categories, hours, and attributes between Nabatable and Google Business Profile. While backed by excellent Playwright integration tests, the mental model is confusing to first-time admins.

Operators often interpret the prominent Google connection card and sync status bar as a mandatory setup step rather than an optional import/reconciliation booster. Furthermore, if Google sync fails (due to API rate limiting or account verification blocks), the errors appear as transient toasts that are easily missed, leading to silent synchronization failures.

## Proposed IA

1. **Explain Optionality Above the Fold**: Introduce a clear info card in the integration sub-header: _"Google connection is 100% optional. Use it to import address and categories instantly, or manage them fully in Nabatable without Google."_
2. **Persistent Sync-Error Banner**: Mount `PersistentGbpErrorAlert.tsx` directly above the connection cards. If the sync state drifts or hits an API blocker, this banner remains visible, presenting a clear action button (e.g., _"Reconnect Google Account"_ or _"Dismiss Drift"_).
3. **Compare Filter**: By default, collapse compare groups where the sync states are 100% aligned. Introduce a toggle _"Show all fields"_ versus _"Only show drifting fields"_. This minimizes vertical clutter by hiding identical rows.

## Non-Goals

- No changes to Google Business Profile OAuth scopes, token refreshes, or Google-side sync worker cron jobs.
- No redesign of the raw differences comparison table engine.

## Files Touched

- `src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection.tsx`
- `src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx`
- `src/components/features/restaurant-settings/google-business-profile/sections/PersistentGbpErrorAlert.tsx` (enhance to be highly visible)
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOverviewCard.tsx` (add optionality messaging)

## Risks

- **OAuth Boundary Breaks**: If we refresh the UI too aggressively, we could accidentally interrupt active OAuth redirect loops on Google’s side.
- **Drift provider caching**: We must ensure that manual drift refresh actions correctly invalidate the local SWR TanStack query caches to prevent visual sync mismatches.

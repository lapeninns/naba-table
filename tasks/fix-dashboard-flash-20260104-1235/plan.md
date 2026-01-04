# Implementation Plan: Fix Dashboard Flash

## Objective

Prevent the "You are offline" red alert from briefly flashing on the dashboard during initial page load.

## Success Criteria

- [x] No flash of offline indicator on initial load when online.
- [x] Offline indicator still works correctly when actually offline.

## Architecture & Components

- `OpsOfflineIndicator`: Add hydration check before rendering.

## Testing Strategy

- Manual verification by user.

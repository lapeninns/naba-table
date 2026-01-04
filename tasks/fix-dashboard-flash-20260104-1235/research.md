# Research: Fix Dashboard Flash

## Requirements

- Functional:
  - Prevent the red "You are offline" alert from flashing on page load when the user is actually online.
- Non-functional:
  - Maintain offline detection functionality.
  - Prevent hydration mismatches.

## Existing Patterns & Reuse

- `useOnlineStatus` hook handles online/offline detection.
- `OpsOfflineIndicator` displays the alert when offline.

## Constraints & Risks

- SSR/hydration timing can cause initial state mismatches.

## Recommended Direction

- Add hydration guard to `OpsOfflineIndicator` to prevent rendering until client-side hydration is complete.

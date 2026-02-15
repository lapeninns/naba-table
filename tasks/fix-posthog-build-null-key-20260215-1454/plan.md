---
task: fix-posthog-build-null-key
timestamp_utc: 2026-02-15T14:54:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix PostHog Build Null Key Type Error

## Objective

Ensure the PostHog provider only initializes when non-null key/host values are available, satisfying both runtime and TypeScript invariants.

## Success Criteria

- [ ] `pnpm run build` passes without `string | null` error in `lib/posthog/provider.tsx`.
- [ ] PostHog init code remains unchanged for valid env configuration.

## Architecture & Components

- `lib/posthog/provider.tsx`: add explicit runtime narrowing and use narrowed variables in `posthog.init` options.

## Data Flow & API Contracts

- No API contract changes.

## UI/UX States

- Not applicable (no UI surface change).

## Edge Cases

- `enabled=true` but missing `key`/`host` due to runtime mismatch: guard prevents invalid init.

## Testing Strategy

- Run `pnpm run build`.
- Run targeted `pnpm exec tsc --noEmit --pretty false` if needed to confirm type resolution.

## Rollout

- No feature flag needed.
- Safe to deploy with standard release.

## DB Change Plan (if applicable)

- Not applicable.

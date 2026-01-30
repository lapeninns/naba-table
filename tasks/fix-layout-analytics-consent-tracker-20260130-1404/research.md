---
task: fix-layout-analytics-consent-tracker
timestamp_utc: 2026-01-30T14:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Preserve static layout + bound Supabase N+1 tracker

## Requirements

- Functional:
  - Remove `cookies()` usage from `src/app/layout.tsx` to avoid forcing dynamic rendering.
  - Keep analytics consent gating for Plausible/PostHog based on `nat_consent` cookie.
  - Bound `server/supabase-instrumentation.ts` signature tracking memory.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve CDN/static caching for public pages.
  - Avoid memory growth in long-lived server processes.
  - Maintain best-effort instrumentation without throwing.

## Existing Patterns & Reuse

- Client-side consent check already exists in `src/app/providers.tsx` (`useAnalyticsConsent`).
- Consent banner manages `nat_consent` cookie in `components/CookieConsentBanner.tsx`.

## External Resources

- `next-plausible` supports client-side provider usage and an `enabled` prop; no external changes needed.

## Constraints & Risks

- Root layout should remain server component without request-bound reads.
- Supabase instrumentation should remain Edge-safe and low-overhead.

## Open Questions (owner, due)

- Q: Should Plausible be wrapped together with PostHog under the same consent gate? (owner: github:@amanshresthaa, due: 2026-01-30)
  A: Yes — use the existing `useAnalyticsConsent` hook.

## Recommended Direction (with rationale)

- Move Plausible provider into `AppProviders` (client) behind the existing consent hook to keep RootLayout static while preserving consent gating.
- Add TTL-based pruning + size cap to the N+1 signature map to avoid unbounded growth.

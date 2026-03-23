---
task: posthog-error-audit
timestamp_utc: 2026-03-23T11:16:38Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: PostHog Error Audit

## Requirements

- Functional:
  - Fetch the current PostHog error inventory for the active project.
  - Identify which errors are actionable and what should be fixed first.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Read-only investigation.
  - Keep secrets and sensitive event payloads out of committed artifacts.

## Existing Patterns & Reuse

- Use the PostHog MCP tools for error inventory and issue details.
- Record investigation outputs in a timestamped `tasks/` directory.
- Existing PostHog noise suppression already lives in:
  - `lib/posthog/error-filter.ts`
  - `lib/posthog/provider.tsx`
- Prior task `tasks/posthog-issue-noise-hardening-20260219-1314/` already classified the recurring IndexedDB update rejections as non-actionable telemetry noise.

## External Resources

- PostHog MCP issue and error endpoints — authoritative source for current tracked runtime errors.

## Constraints & Risks

- Default PostHog project/org context may not match every deployment environment.
- Some issues may be stale, sampled, or already fixed in code but still open in telemetry.
- Error details may not expose a full stack trace for every issue.
- Missing production source maps reduce confidence when mapping minified stack traces back to code.

## Open Questions (owner, due)

- Which active PostHog project is currently selected in MCP context? (assistant, resolved: `Default project` / `120939`)
- Are there environment-specific issues that should be filtered out from the main fix list? (assistant, resolved: yes; localhost-only chunk errors and already-suppressed PostHog storage noise)

## Findings

- The active PostHog context is `Lapen Inns / Default project` (`120939`).
- There are `30` active error issues in PostHog, but only a small subset look actionable.
- Only two active issue fingerprints were seen in mid-March:
  - `Script error.` on public booking pages (`36` total occurrences, `3` in the latest March bucket).
  - A new public booking page crash: `undefined is not an object (evaluating 'a.length')` on `2026-03-16`.
- The previously noisy auth callback issues (`Failed to fetch` and `Object Not Found Matching Id:* update`) last appeared on `2026-02-17`/`2026-02-18`, before the repository’s `2026-02-19` noise-hardening work.
- Several ops-side February errors line up with unsafe optimistic cache mutations:
  - `src/hooks/ops/useOpsBookingStatusActions.ts`
  - `hooks/useUpdateBooking.ts`
  - `hooks/useCancelBooking.ts`
  - `hooks/ops/useUpdateRestaurant.ts`
- The `/settings/tables` `toLowerCase` crash likely matches `membership.restaurantName.toLowerCase()` in `src/components/features/ops-shell/OpsRestaurantSwitch.tsx`.
- Many stack traces are only partially useful because deployed `*.js.map` files return `404`.

## Recommended Direction (with rationale)

- Prioritize first-party recurring issues over stale or already-suppressed telemetry noise.
- Fix the null/shape assumptions in optimistic React Query cache updates and ops restaurant-switch search first; those have direct repo matches and low ambiguity.
- Treat production source map availability as an enabling fix: it is not the user-facing bug, but it is necessary to make the remaining public-booking and minified React crashes debuggable.
- Close or suppress stale auth callback/storage-noise issues if PostHog confirms they have not recurred after the February hardening patch.

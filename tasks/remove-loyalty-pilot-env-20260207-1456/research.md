---
task: remove-loyalty-pilot-env
timestamp_utc: 2026-02-07T14:56:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove `LOYALTY_PILOT_RESTAURANT_IDS` Env Plumbing

## Requirements

- Functional:
  - Remove runtime parsing/export of `LOYALTY_PILOT_RESTAURANT_IDS`.
  - Remove any code using that env var (directly or indirectly).
  - Keep environment runtime invariants clean: validate required env inputs; do not leave dead or misleading config.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No behavior change beyond removing the pilot gating mechanism.
  - Do not introduce new dependencies.
  - No secrets added to source.

## Existing Patterns & Reuse

- Server-side env validation and typed access:
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/config/env.schema.ts` defines `baseEnvSchema` and `envSchemas` using Zod.
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/env.ts` parses + caches env, and exposes structured getters (including `env.featureFlags`).
- Current `LOYALTY_PILOT_RESTAURANT_IDS` plumbing:
  - Declared as optional env key in `baseEnvSchema`.
  - Exposed from `env.featureFlags.loyaltyPilotRestaurantIds`.
  - Used only in `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/feature-flags.ts` to populate a set and expose `isLoyaltyPilotRestaurant()`.

## External Resources

- None required for removal.

## Constraints & Risks

- This repo enforces runtime env validation. Removal must delete the schema entry and any exports/usages so TypeScript and runtime validation remain coherent.
- Avoid removing unrelated loyalty code (there are other loyalty stubs/docs). Scope is limited to the env var plumbing and the now-dead pilot helper.

## Open Questions (owner, due)

- Should the loyalty pilot now be treated as always-enabled for all restaurants (i.e., remove gating), or is the pilot concept being removed entirely? (Not required to complete env-var removal because there are no external call sites today.)

## Recommended Direction (with rationale)

- Remove `LOYALTY_PILOT_RESTAURANT_IDS` from:
  - `baseEnvSchema` (so env validation/types do not expose it),
  - `env.featureFlags` return shape,
  - and server feature flag helpers (`isLoyaltyPilotRestaurant` and its parsing).
- Rationale: This makes the removal canonical with a single source of truth (the Zod schema) and avoids leaving unused config knobs.

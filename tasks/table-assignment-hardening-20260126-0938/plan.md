---
task: table-assignment-hardening
timestamp_utc: 2026-01-26T09:38:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Table Assignment Hardening

## Objective

Harden table assignment by enforcing adjacency as always-on (connected), enforcing strict quote policies, and improving pruning diagnostics without changing core scoring behavior.

## Success Criteria

- [ ] Adjacency is always required with connected-mode enforcement.
- [ ] No API/service path allows disabling adjacency.
- [ ] Adjacency failures emit telemetry with table set details.
- [ ] Quote flow enforces zone-lock, disallows overflow fallback, and fails fast on hold conflicts.
- [ ] Selector diagnostics indicate early exits and timeouts.
- [ ] Tests cover new behavior and existing suites pass.

## Architecture & Components

- `lib/env.ts`: enforce always-on allocator adjacency (connected).
- `server/feature-flags.ts`: return fixed adjacency requirement/mode.
- `server/capacity/table-assignment/quote.ts`: strict policy enforcement.
- `server/capacity/selector.ts`: early-exit/timeout diagnostics.
- Docs: record adjacency as fixed.

## Data Flow & API Contracts

- No API contract changes. Quote failures will include explicit reason strings.

## UI/UX States

- N/A

## Edge Cases

- Zone-locked bookings with mismatched zoneId param.
- Hold conflicts encountered pre/post hold creation.
- Selector timeouts on large combinations.

## Testing Strategy

- Unit: feature flag parsing and selector diagnostics.
- Unit/Integration: quote strictness logic (zone lock + hold conflict).
- Performance: run `scripts/capacity-load-test.ts` against a target restaurant.

## Rollout

- Feature flag: none (always-on).
- Exposure: code change; no staged rollout unless requested.
- Monitoring: selector diagnostics + quote failure reasons.

## DB Change Plan (if applicable)

- N/A

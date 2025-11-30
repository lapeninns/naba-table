---
task: move-config-to-code
timestamp_utc: 2025-11-30T16:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm scope of configs to remove (strategic_configs, service_policy, feature_flag_overrides) and desired behaviour for POST/updates.
- [x] Add env schema entries and defaults for strategic + service policy.

## Core

- [x] Refactor strategic config loaders/services to be code/env backed; remove Supabase queries and overrides.
- [x] Keep service policy API/ops tables reading from DB (restaurant-level settings).
- [x] Remove feature flag overrides plumbing; ensure feature flags use env.
- [ ] Add/drop migrations to remove or clear strategic/feature_flag tables (service_policy stays). (Currently added cleanup migration to clear tables, not drop.)

## UI/UX

- [x] Update any UI/editor flows for strategic settings to reflect read-only/code-based config.
- [ ] Ensure loading/error states still render sane messages.

## Tests

- [ ] Update/add unit tests for strategic config and service policy providers.
- [ ] Update API route tests to match new behaviour.
- [ ] Run relevant test suite.

## Notes

- Assumptions: global code-level config acceptable; per-restaurant overrides can be dropped.
- Deviations: POST for strategic config likely disabled; document clearly.

## Batched Questions

- How should existing strategic-config editing UI behave (disable or show “deploy-time only”)?

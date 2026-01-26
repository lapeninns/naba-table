---
task: feature-inventory
timestamp_utc: 2026-01-26T13:46:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops + Guest Feature Inventory

## Objective

We will compile a complete, code-sourced inventory of ops and guest features across UI, APIs, jobs, and feature flags, grouped by domain categories, to provide a single reference of system capabilities.

## Success Criteria

- [ ] All ops and guest UI routes mapped to features with category + source path.
- [ ] All ops and guest APIs mapped to features with category + source path.
- [ ] Background jobs and feature flags included where applicable.
- [ ] Output produced in Markdown and CSV formats.

## Architecture & Components

- Source extraction from docs + Next.js route tree + nav configs.
- Normalization into a feature registry with stable fields.
- Categorization by domain (Bookings, Customers, Tables/Floor Plan, Settings/Team, Restaurants/Search, Auth/Profile, Analytics, Messaging/Notifications, Infra/Safety).

## Data Flow & API Contracts

- N/A (documentation-only output).

## UI/UX States

- N/A.

## Edge Cases

- Legacy/redirected routes listed in docs but missing in source.
- Internal helpers that mention guest/ops but are not features.

## Testing Strategy

- Manual verification: route doc ↔ route tree counts.
- `rg` audits for `ops` and `guest` to ensure coverage.

## Rollout

- N/A.

## DB Change Plan (if applicable)

- N/A.

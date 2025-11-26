---
task: remove-default-restaurant
timestamp_utc: 2025-11-26T10:58:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
---

# Implementation Checklist

## Setup

- [x] Remove fallback default restaurant values from config/env helpers and venue config.

## Core

- [x] Change getDefaultRestaurantId logic to require explicit env/param and return an error when absent; update API routes to handle missing context.
- [x] Update UI links/components that depended on DEFAULT*RESTAURANT*\* to use a neutral path or require selection.
- [ ] Adjust tests and fixtures to provide restaurant id/slug explicitly.

## Tests

- [ ] Run/extend route tests (bookings/availability) to cover missing-restaurant error.

## Docs/Verification

- [ ] Update env examples/docs to remove White Horse defaults and describe required config.
- [ ] Record verification in verification.md.

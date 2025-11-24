---
task: fix-reservation-rebook-slug
timestamp_utc: 2025-11-24T12:41:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update Supabase reservation query to include restaurant slug.
- [x] Extend reservation schema/adapter to normalize `restaurantSlug`.

## Core

- [x] Use normalized slug in `ReservationDetailClient` rebook link with venue fallback.

## UI/UX

- [x] Ensure rebook link still resolves when slug missing (code fallback).

## Tests

- [x] Run `pnpm run build` and confirm success.

## Notes

- Assumptions: Supabase `restaurants` table exposes `slug` field; API returns it when selected.
- Deviations: None yet.

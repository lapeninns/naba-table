---
task: google-business-profile-sync
timestamp_utc: 2026-04-07T11:18:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add Google Business Profile environment schema/config entries
- [x] Add database schema for restaurant-linked Google Business Profile sync state

## Core

- [x] Build server helpers for OAuth state, token encryption, and Google API access
- [x] Add Ops API routes for connect, callback, status, and sync
- [x] Extend restaurant settings service and hooks for Google profile state
- [x] Add persistent GBP sync history storage and return it from the canonical status/sync APIs

## UI/UX

- [x] Add dedicated Google Business Profile settings page and route
- [x] Remove embedded Google Business Profile UI from restaurant profile settings
- [x] Show disconnected, connected, syncing, synced, partial, and error states
- [x] Surface imported profile details and family-by-family diagnostics for Ops review
- [x] Add a recent sync history timeline to the dedicated GBP workspace
- [x] Add latest-sync change detection so Ops can review what Google data changed between syncs

## Landing Page

- [x] Extend public restaurant data enrichment to consume normalized Google snapshot fields
- [x] Keep manual restaurant data as fallback when Google data is absent
- [x] Surface richer GBP signals on public restaurant guides (open status, hours, reviews, media, links)

## Tests

- [x] Unit
- [x] Integration
- [x] Dev harness / UI proof
- [x] Extend focused tests and browser proof for sync history
- [x] Add focused diff tests and browser proof for the latest-sync change summary

## Notes

- Assumptions:
  - First delivery can normalize the most useful location/profile fields while storing raw snapshots for future expansion.
  - Optional Google API families may fail independently, and that should not block the rest of the sync result from being saved.
- Deviations:
  - Earlier verification covered the embedded profile implementation; this pass is moving GBP to a dedicated settings page and will require fresh browser proof.
  - Remote Supabase migration apply/dry-run is intentionally not executed from local dev; apply on staging first with backup/PITR confirmation.
  - `validate:env` now intentionally blocks when `SUPABASE_DB_URL` and `NEXT_PUBLIC_SUPABASE_URL` point at different Supabase projects, because that mismatch makes remote migration commands unsafe.
  - Sync history is being added as a follow-on slice after the dedicated-page and public-enrichment work, so fresh verification will focus on the dedicated GBP workspace rather than re-covering every previously proven area.

## Batched Questions

- None currently blocking implementation.

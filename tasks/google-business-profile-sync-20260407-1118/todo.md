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

## UI/UX

- [x] Add Google Business Profile section to restaurant profile settings
- [x] Show disconnected, connected, syncing, synced, and error states
- [x] Surface imported profile highlights for Ops review

## Landing Page

- [x] Extend public restaurant data enrichment to consume normalized Google snapshot fields
- [x] Keep manual restaurant data as fallback when Google data is absent

## Tests

- [x] Unit
- [x] Integration
- [x] Dev harness / UI proof

## Notes

- Assumptions:
  - First delivery can normalize the most useful location/profile fields while storing raw snapshots for future expansion.
- Deviations:
  - Chrome DevTools QA used the existing local dev harnesses plus a GBP-enriched directory harness fixture; no remote Google OAuth credentials were used during local verification.
  - Remote Supabase migration apply/dry-run is intentionally not executed from local dev; apply on staging first with backup/PITR confirmation.

## Batched Questions

- None currently blocking implementation.

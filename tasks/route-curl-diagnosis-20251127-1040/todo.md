---
task: route-curl-diagnosis
timestamp_utc: 2025-11-27T10:40:20Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Start dev server (`pnpm dev --hostname 0.0.0.0 --port 3000`).

## Investigation

- [x] Curl public/marketing routes (/, /thank-you).
- [x] Curl guest routes (/guest, /guest/bookings).
- [x] Curl app routes (/app) noting auth redirects/errors.
- [x] Curl representative APIs (/api/availability, /api/bookings, /api/ops/bookings, /api/ops/restaurants) safely with GET.
- [x] Save responses/status to artifacts.

## Verification

- [x] Summarize findings and likely causes per route.
- [x] Update verification.md with results.

## Notes

- Avoid POST/PUT/DELETE to prevent data mutation.

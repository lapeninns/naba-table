---
task: magic-link-incident-audit
timestamp_utc: 2026-02-19T14:34:32Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Production Magic-Link Incident Audit

## Objective

Establish whether production magic-link activity is malicious and identify the most likely root cause behind requests from users with no booking history.

## Success Criteria

- [x] Quantified magic-link volume for last 24h and 7d.
- [x] Correlated recipients against `customers` and `bookings`.
- [x] Pulled production `/api/auth/signin` request logs and classified status patterns.
- [x] Identified concrete failure mode(s) contributing to suspicious behavior.

## Architecture & Components

- Data sources:
  - Resend transactional email listing (`emails.list`) filtered by magic-link subject.
  - Supabase service-role queries for `customers`, `bookings`, `restaurant_memberships`.
  - Vercel request logs (`vercel logsv2`) for `/api/auth/signin`.
- Correlation output:
  - Per-recipient request counts + booking/customer presence.
  - Domain distribution and burst windows.
  - Auth endpoint status breakdown and 500-error signatures.

## Data Flow & API Contracts

- Read-only calls only:
  - Resend API list endpoint.
  - Supabase PostgREST queries through service-role client.
  - Vercel logs API via CLI.
- No mutation endpoints and no schema changes.

## UI/UX States

- Not applicable (incident telemetry investigation only).

## Edge Cases

- Resend list rate limits (`rate_limit_exceeded`) handled via backoff.
- Auth admin pagination errors captured as explicit caveat in artifacts.
- Partial Vercel retention handled by explicit earliest/latest timestamps in summary.

## Testing Strategy

- Deterministic audit scripts executed from repo root using production env file.
- Independent summaries generated from raw artifacts.
- Manual cross-check of key anomalies against source code paths.

## Rollout

- No code rollout in this task.
- Deliver findings + hardening recommendations.

## DB Change Plan

- No DB changes.

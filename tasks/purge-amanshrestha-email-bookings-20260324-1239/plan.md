---
task: purge-amanshrestha-email-bookings
timestamp_utc: 2026-03-24T12:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Purge bookings for masked guest email

## Objective

We will preview and then hard-delete all production bookings for one exact guest email so the dataset is cleared safely and completely.

## Success Criteria

- [ ] Production preview returns the exact bookings targeted for deletion.
- [ ] Dependent booking-linked rows are removed before parent booking deletes.
- [ ] Post-check shows zero remaining bookings for the target email.

## Architecture & Components

- Local one-off admin execution via Node + `pg` using production env values from a local env file.
- SQL scope: `lower(customer_email) = lower($1)`.
- Delete order mirrors the canonical restaurant purge script to avoid FK issues in production.

## Data Flow & API Contracts

- Preview query returns booking IDs, references, restaurants, statuses, and schedule fields for operator verification.
- Delete transaction resolves target booking IDs once, deletes dependent rows, deletes bookings, and returns counts.

## UI/UX States

- N/A — direct admin database operation.

## Edge Cases

- No matching bookings.
- Child tables absent or empty.
- Mixed-case email values in production data.

## Testing Strategy

- Read-only preview before apply.
- Transactional apply with row-count logging.
- Post-delete verification query returning zero rows.

## Rollout

- One-time production admin action.
- No feature flag.
- Rollback is not practical after hard delete; rely on pre-check scope validation and transaction safety.

---
task: delete-amanshrestha-records
timestamp_utc: 2026-04-13T11:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Delete Records For Specific Contact

## Objective

We will identify and, if confirmed, remove all application records tied to `amanshresthaaaaa@gmail.com` and `07467586751` from staging and production, starting with dry-run impact reports so the deletion scope is explicit before any writes occur.

## Success Criteria

- [ ] Staging dry run reports all matched rows and dependent row counts.
- [ ] Production dry run reports all matched rows and dependent row counts.
- [ ] The delete path is limited to the canonical data graph for the matched contact.
- [ ] No delete is executed against production without an explicit final confirmation after dry-run review.

## Architecture & Components

- Task-local SQL under `tasks/delete-amanshrestha-records-20260413-1137/artifacts/`:
  - dry-run query for environment-specific impact analysis
  - delete query in dependency order for later apply
- Existing repo helpers:
  - `scripts/apply-sql-file.ts` for remote SQL execution
  - `server/customers.ts` normalization rules used to mirror app semantics

## Data Flow & API Contracts

- Input:
  - email: `amanshresthaaaaa@gmail.com`
  - phone: `07467586751`
- Match strategy:
  - direct email match on lowercase email fields
  - normalized phone match against comparable numeric phone forms
  - derive `customer_id` set from `customers`
  - derive `booking_id` set from `bookings` and any booking-linked rows
- Target tables expected in scope:
  - `customers`
  - `customer_profiles`
  - `bookings`
  - `booking_table_assignments`
  - `booking_state_history`
  - `booking_assignment_attempts`
  - `booking_assignment_idempotency`
  - `booking_confirmation_results`
  - `booking_versions`
  - `analytics_events`
  - `table_holds`
  - `table_soft_holds`
  - `email_delivery_log`
  - `email_dispatch_intents`
  - `allocations`
  - `capacity_outbox`
  - `waiting_list`
  - `leads`
- Auth or user-profile tables are inspect-first, not auto-delete, unless the dry run proves they are part of the requested blast radius and we confirm the implications.

## UI/UX States

- None; backend/data operation only.

## Edge Cases

- The contact may exist in one environment but not the other.
- The same contact may exist across multiple restaurants.
- Some rows may only contain denormalized contact fields without a live `customer_id`.
- Historical logs may reference booking ids after the booking rows are selected for deletion.

## Testing Strategy

- No app code changes planned.
- Verification path is environment-scoped SQL dry runs plus artifact capture.
- If an apply is later approved, re-run the dry run immediately before the delete and verify post-delete zero matches.

## Rollout

- Order:
  1. Dry run on staging
  2. Dry run on production
  3. Review impact
  4. Re-run fresh dry run
  5. Apply staging delete if requested
  6. Apply production delete if requested
- Monitoring:
  - compare pre/post counts for all matched tables
  - preserve raw SQL output in task artifacts
- Kill-switch:
  - stop before apply; no code deploy is involved

## DB Change Plan (if applicable)

- Target envs: staging (`ndxmivcrehsacuerwxtm`) then production (`vrdiqfudmwydclqpydee`)
- Backup reference: no schema migration; this is a targeted data delete with dry-run evidence recorded before apply
- Dry-run evidence:
  - `artifacts/staging-dry-run.txt`
  - `artifacts/production-dry-run.txt`
- Rollback plan:
  - pause before apply until impact is reviewed
  - if apply is later executed, recovery would require restoring rows from remote backups/PITR because hard deletes are not trivially reversible

---
task: delete-amanshrestha-records
timestamp_utc: 2026-04-13T11:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Remote Dry Run

- Final-scope staging dry run completed against project `ndxmivcrehsacuerwxtm`.
- Final-scope production dry run completed against project `vrdiqfudmwydclqpydee`.
- Public app-data delete was then executed on staging first and production second.
- Post-delete verification shows zero remaining public app-data matches in both environments.

### Staging Summary

- Matched restaurants: `the-old-crown-girton`, `seed-perf-r001`
- Matched customers: `2`
- Matched bookings: `8`
- Dependent rows:
  - `analytics_events`: `11`
  - `email_delivery_log`: `14`
  - `customer_profiles`: `2`
  - `booking_assignment_idempotency`: `4`
  - `booking_confirmation_results`: `9`
  - `booking_state_history`: `8`
  - `booking_table_assignments`: `5`
  - `allocations`: `9`
  - `capacity_outbox`: `27`
  - `email_dispatch_intents`: `2`
- Best-effort auth inspection found `1` auth user matching the target email.

### Production Summary

- Matched restaurants: `the-old-crown-girton`, `the-railway-pub`, `three-horseshoes`, `white-horse-pub-waterbeach`
- Matched customers: `4`
- Matched bookings: `2`
- Dependent rows:
  - `analytics_events`: `8`
  - `email_delivery_log`: `16`
  - `customer_profiles`: `4`
  - `booking_assignment_idempotency`: `2`
  - `booking_confirmation_results`: `3`
  - `booking_state_history`: `3`
  - `booking_table_assignments`: `3`
  - `allocations`: `5`
  - `capacity_outbox`: `9`
  - `email_dispatch_intents`: `4`
- Important nuance: one matched production customer row belongs to `three-horseshoes` and uses email `amanshresthaa.uk@gmail.com`, but the same phone number `+447467586751`.
- Two matched production customer rows carry `auth_user_id` values, but auth-admin inspection returned `Database error finding users`, so auth cleanup remains a manual confirmation point.

## Apply Results

### Staging Apply

- Delete completed successfully on the first attempt.
- Deleted rows:
  - `customers`: `2`
  - `bookings`: `8`
  - `customer_profiles`: `2`
  - `analytics_events`: `11`
  - `email_delivery_log`: `14`
  - `booking_assignment_idempotency`: `4`
  - `booking_confirmation_results`: `9`
  - `booking_state_history`: `8`
  - `booking_table_assignments`: `5`
  - `allocations`: `9`
  - `capacity_outbox`: `27`
  - `email_dispatch_intents`: `2`

### Production Apply

- The first production attempt deleted some dependent rows, then stopped when Supabase/PostgREST reported `table_soft_holds` missing from schema cache.
- The task-local runner was patched to ignore missing-table deletes, and the resumed apply completed successfully.
- Final deleted rows from the resumed pass:
  - `customers`: `5`
  - `bookings`: `2`
  - `customer_profiles`: `4`
  - `email_delivery_log`: `16`
  - `email_dispatch_intents`: `4`
  - `allocations`: `5`
  - `capacity_outbox`: `9`
- The earlier failed pass had already removed the remaining dependent rows such as `analytics_events`, `booking_assignment_idempotency`, `booking_confirmation_results`, `booking_state_history`, and `booking_table_assignments`.

## Post-Delete Verification

- Staging post-delete verification:
  - `customers`: `0`
  - `bookings`: `0`
  - all other public app-data counts in scope: `0`
  - best-effort auth inspection still sees `1` auth user, which was intentionally left untouched
- Production post-delete verification:
  - `customers`: `0`
  - `bookings`: `0`
  - all other public app-data counts in scope: `0`
  - auth-admin inspection still returns `Database error finding users`, so auth state remains unverified and unchanged by this task

## Rerun After Initial Cleanup

- A subsequent rerun found no remaining in-scope public app data in staging.
- The same rerun found new production public app data tied to the same phone number at `the-old-crown-girton`:
  - `customers`: `1`
  - `bookings`: `2`
  - `analytics_events`: `2`
  - `email_delivery_log`: `1`
  - `customer_profiles`: `1`
  - `booking_assignment_idempotency`: `2`
  - `booking_confirmation_results`: `2`
  - `booking_state_history`: `2`
  - `booking_table_assignments`: `2`
  - `allocations`: `2`
  - `capacity_outbox`: `6`
  - `email_dispatch_intents`: `1`
- That production remainder was deleted in a second production apply pass and verified back to zero.

## Wrap-Up Recheck (2026-04-13 13:15 UTC)

- A final dry-run recheck was executed on 2026-04-13 against both staging and production using the final-scope email set plus phone match.
- Staging remains clear for all in-scope public application data:
  - `customers`: `0`
  - `bookings`: `0`
  - all other public app-data counts in scope: `0`
  - one auth user still exists in staging and remains intentionally untouched by this task
- Production remains clear for all in-scope public application data:
  - `customers`: `0`
  - `bookings`: `0`
  - all other public app-data counts in scope: `0`
  - auth-admin lookup still returns `Database error finding users`, so auth state remains outside the verified blast radius

## Commands

- `set -a; source .env.local; set +a; REPORT_LABEL=staging EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAIL=amanshresthaaaaa@gmail.com CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-dry-run.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAIL=amanshresthaaaaa@gmail.com CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-dry-run.txt`
- `set -a; source .env.local; set +a; REPORT_LABEL=staging EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-dry-run-final-scope.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-dry-run-final-scope.txt`
- `set -a; source .env.local; set +a; REPORT_LABEL=staging EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts --apply > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-apply.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts --apply > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-apply.txt`
- `set -a; source .env.local; set +a; REPORT_LABEL=staging-post EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-post-delete.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production-post EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-post-delete.txt`
- `set -a; source .env.local; set +a; REPORT_LABEL=staging-rerun EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-rerun-dry-run.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production-rerun EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-rerun-dry-run.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production-rerun EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts --apply > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-rerun-apply.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production-rerun-post EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-rerun-post-delete.txt`
- `set -a; source .env.local; set +a; REPORT_LABEL=staging-wrapup EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/staging-wrapup-dry-run-20260413-1315.txt`
- `set -a; source .env.vercel-production; set +a; REPORT_LABEL=production-wrapup EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee CONTACT_EMAILS='amanshresthaaaaa@gmail.com,amanshresthaa.uk@gmail.com' CONTACT_PHONE=07467586751 pnpm -s tsx tasks/delete-amanshrestha-records-20260413-1137/artifacts/contact-records.ts > tasks/delete-amanshrestha-records-20260413-1137/artifacts/production-wrapup-dry-run-20260413-1315.txt`

## Artifacts

- Staging dry run: `artifacts/staging-dry-run.txt`
- Production dry run: `artifacts/production-dry-run.txt`
- Task-local runner: `artifacts/contact-records.ts`
- Final-scope staging dry run: `artifacts/staging-dry-run-final-scope.txt`
- Final-scope production dry run: `artifacts/production-dry-run-final-scope.txt`
- Staging apply: `artifacts/staging-apply.txt`
- Production apply: `artifacts/production-apply.txt`
- Staging post-delete verification: `artifacts/staging-post-delete.txt`
- Production post-delete verification: `artifacts/production-post-delete.txt`
- Staging rerun dry run: `artifacts/staging-rerun-dry-run.txt`
- Production rerun dry run: `artifacts/production-rerun-dry-run.txt`
- Production rerun apply: `artifacts/production-rerun-apply.txt`
- Production rerun post-delete verification: `artifacts/production-rerun-post-delete.txt`
- Staging wrap-up dry run (2026-04-13 13:15 UTC): `artifacts/staging-wrapup-dry-run-20260413-1315.txt`
- Production wrap-up dry run (2026-04-13 13:15 UTC): `artifacts/production-wrapup-dry-run-20260413-1315.txt`

## Known Issues

- Production auth-admin lookup is not reliable in this environment, so auth cleanup remains separate from this public-data deletion task.
- The runner had to tolerate a missing-table schema-cache response for `table_soft_holds` during production apply, but post-delete verification confirms no in-scope public app data remains.

## Sign-off

- [x] Engineering
